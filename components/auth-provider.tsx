// components/auth-provider.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Interface para o tipo de contexto de autenticação
interface AuthContextType {
  user: User | null;      // O objeto do usuário do Firebase, ou null se não estiver logado
  loading: boolean;     // True enquanto o estado de autenticação inicial está sendo determinado
}

// Criação do Contexto de Autenticação com valores padrão
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true, // Começa como true, pois estamos inicialmente carregando o estado
});

/**
 * Hook customizado para consumir o AuthContext.
 * Facilita o acesso ao usuário e ao estado de loading nos componentes.
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Provedor de Autenticação que envolve a aplicação ou partes dela.
 * Ele gerencia o estado do usuário (logado/deslogado) usando o Firebase.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Estado de loading inicial

  useEffect(() => {
    console.log("[AuthProvider] Subscribing to onAuthStateChanged (montagem do provider)");

    // onAuthStateChanged é o listener do Firebase que notifica sobre mudanças no estado de autenticação.
    // Ele dispara imediatamente com o estado atual e depois sempre que o estado muda.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Usuário está logado
        console.log("[AuthProvider] onAuthStateChanged: User IS logged in. UID:", firebaseUser.uid);
        setUser(firebaseUser);
      } else {
        // Usuário está deslogado
        console.log("[AuthProvider] onAuthStateChanged: User IS NOT logged in.");
        setUser(null);
      }
      // Importante: setLoading(false) é chamado AQUI, após o Firebase ter fornecido
      // o estado inicial do usuário (seja ele logado ou não).
      // Isso garante que `loading` só se torne `false` quando soubermos
      // definitivamente se há um usuário na sessão atual.
      console.log("[AuthProvider] onAuthStateChanged: Setting loading to false.");
      setLoading(false);
    });

    // Função de limpeza: Cancela a inscrição no listener quando o AuthProvider é desmontado.
    // Isso evita memory leaks.
    return () => {
      console.log("[AuthProvider] Unsubscribing from onAuthStateChanged (desmontagem do provider)");
      unsubscribe();
    };
  }, []); // O array de dependências vazio [] significa que este useEffect executa apenas uma vez (na montagem)

  // Efeito para logar mudanças no usuário ou no estado de loading (para depuração)
  useEffect(() => {
    console.log("[AuthProvider] Context values updated - User:", user ? user.uid : null, "Loading:", loading);
  }, [user, loading]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}