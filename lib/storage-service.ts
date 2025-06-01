// lib/storage-service.ts
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, storage } from "./firebase"; // storage exportado de lib/firebase.ts

export const uploadFileToStorage = async (
  file: File,
  storagePath: string,
  progressCallback?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // UID do usuário será pego dentro do AuthProvider ou passado como argumento se necessário
    // Aqui, vamos assumir que o auth.currentUser estará disponível no momento do upload
    // Se for chamado durante o registro antes do usuário estar 100% no AuthProvider,
    // pode ser necessário passar o user.uid obtido do createUserWithEmailAndPassword.
    // Para uploads PÓS login, auth.currentUser funciona bem.

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (progressCallback) {
          progressCallback(progress);
        }
        console.log(`[StorageService] Upload de ${file.name} está ${progress}% done`);
      },
      (error) => {
        console.error("[StorageService] Falha no upload:", error);
        let friendlyMessage = "Erro desconhecido no upload do arquivo.";
        switch (error.code) {
          case "storage/unauthorized":
            friendlyMessage = "Permissão negada. Verifique as regras do Storage.";
            break;
          case "storage/canceled":
            friendlyMessage = "Upload cancelado.";
            break;
          // Adicione outros casos de erro conforme necessário
          default:
            friendlyMessage = `Erro no upload: ${error.message}`;
            break;
        }
        reject(new Error(friendlyMessage));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log(`[StorageService] Arquivo ${file.name} disponível em`, downloadURL);
          resolve(downloadURL);
        } catch (error) {
          console.error("[StorageService] Erro ao obter URL de download:", error);
          reject(new Error("Falha ao obter URL de download após o upload."));
        }
      }
    );
  });
};

export const deleteFileFromStorageByUrl = async (fileUrl: string): Promise<void> => {
    try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
        console.log("[StorageService] Arquivo deletado com sucesso:", fileUrl);
    } catch (error: any) {
        console.error("[StorageService] Erro ao deletar arquivo do Storage:", fileUrl, error);
        if (error.code === 'storage/object-not-found') {
            console.warn("Tentativa de deletar arquivo não encontrado no Storage.");
            return;
        }
        throw new Error("Falha ao deletar arquivo do armazenamento.");
    }
};