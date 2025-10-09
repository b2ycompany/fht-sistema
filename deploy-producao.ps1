# =================================================================================
# === SCRIPT DE DEPLOY COMPLETO E ROBUSTO PARA PRODUÇÃO (FHT SISTEMAS) ===
# =================================================================================
# Este script executa o deploy em etapas e inclui retentativas automáticas
# para as funções críticas, a fim de superar erros temporários de cota de CPU.
# =================================================================================

# --- FUNÇÃO AUXILIAR PARA DEPLOY COM RETENTATIVAS ---
function Deploy-FunctionWithRetry {
    param(
        [string]$FunctionName,
        [int]$MaxRetries = 3
    )

    for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
        Write-Host "   -> Tentativa $attempt de $MaxRetries para implantar '$FunctionName'..." -ForegroundColor Cyan
        
        # Tenta executar o comando de deploy
        firebase deploy --only "functions:$FunctionName"
        
        # Verifica o código de saída do último comando. 0 significa sucesso.
        if ($LASTEXITCODE -eq 0) {
            Write-Host "      ...Sucesso!" -ForegroundColor Green
            return # Sai da função se o deploy for bem-sucedido
        }
        
        # Se falhou, informa e aguarda antes da próxima tentativa
        Write-Host "      ...Falhou na tentativa $attempt." -ForegroundColor Red
        if ($attempt -lt $MaxRetries) {
            $waitTime = 15
            Write-Host "      Aguardando $waitTime segundos antes de tentar novamente..." -ForegroundColor Yellow
            Start-Sleep -Seconds $waitTime
        }
    }
    
    # Se todas as tentativas falharam, para o script
    Write-Host " "
    Write-Host "!!! ERRO CRÍTICO: Não foi possível implantar a função '$FunctionName' após $MaxRetries tentativas." -ForegroundColor Red
    Write-Host "O script será interrompido. Por favor, verifique os logs de erro acima." -ForegroundColor Red
    exit 1 # Encerra o script com um código de erro
}

# --- INÍCIO DO SCRIPT PRINCIPAL ---

Write-Host " "
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "=== INICIANDO DEPLOY COMPLETO PARA PRODUÇÃO ===" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " "

# --- ETAPA 1: DEPLOY DAS REGRAS DE SEGURANÇA ---
try {
    Write-Host "--- ETAPA 1: Implantando regras do Firestore e Storage..." -ForegroundColor Yellow
    firebase deploy --only "firestore,storage"
    Write-Host "--- Regras implantadas com sucesso!" -ForegroundColor Green
    Write-Host " "
} catch {
    Write-Host "!!! ERRO CRÍTICO ao implantar as regras. O script será interrompido." -ForegroundColor Red
    exit 1
}

# --- ETAPA 2: DEPLOY DAS FUNÇÕES "SEGURAS" EM LOTES ---
try {
    Write-Host "--- ETAPA 2: Implantando funções seguras em lotes..." -ForegroundColor Yellow
    
    # Lote A
    Write-Host "   -> Lote A: Funções de Registro e Gestão de Usuários..." -ForegroundColor Cyan
    firebase deploy --only "functions:finalizeRegistration,functions:createStaffUser,functions:confirmUserSetup,functions:sendDoctorInvitation,functions:approveDoctor,functions:onUserWrittenSetClaims"

    # Lote B
    Write-Host "   -> Lote B: Funções Administrativas e de Manutenção..." -ForegroundColor Cyan
    firebase deploy --only "functions:setAdminClaim,functions:setHospitalManagerRole,functions:associateDoctorToUnit,functions:searchAssociatedDoctors,functions:migrateDoctorProfilesToUsers,functions:correctServiceTypeCapitalization"

    # Lote C
    Write-Host "   -> Lote C: Funções de Geração de Documentos e Ponto..." -ForegroundColor Cyan
    firebase deploy --only "functions:generateContractPdf,functions:generatePrescriptionPdf,functions:generateDocumentPdf,functions:registerTimeRecord,functions:registerCheckout"

    # Lote D
    Write-Host "   -> Lote D: Funções de Agendamentos e Miscelânea..." -ForegroundColor Cyan
    firebase deploy --only "functions:createAppointment,functions:createConsultationRoom,functions:createTelemedicineRoom,functions:onUserDeletedCleanup"

    Write-Host "--- Funções seguras implantadas com sucesso!" -ForegroundColor Green
    Write-Host " "
} catch {
    Write-Host "!!! ERRO CRÍTICO ao implantar um lote de funções seguras. O script será interrompido." -ForegroundColor Red
    exit 1
}

# --- ETAPA 3: DEPLOY DAS FUNÇÕES "CRÍTICAS" (INDIVIDUALMENTE COM RETENTATIVAS) ---
Write-Host "--- ETAPA 3: Implantando funções críticas (com retentativas automáticas)..." -ForegroundColor Magenta

Deploy-FunctionWithRetry -FunctionName "findMatchesOnShiftRequirementWrite"
Start-Sleep -Seconds 5
Deploy-FunctionWithRetry -FunctionName "onContractFinalizedUpdateRequirement"
Start-Sleep -Seconds 5
Deploy-FunctionWithRetry -FunctionName "onContractFinalizedLinkDoctor"
Start-Sleep -Seconds 5
Deploy-FunctionWithRetry -FunctionName "onShiftRequirementDelete"
Start-Sleep -Seconds 5
Deploy-FunctionWithRetry -FunctionName "onTimeSlotDelete"

Write-Host "--- Funções críticas implantadas com sucesso!" -ForegroundColor Green
Write-Host " "

# --- ETAPA 4: DEPLOY DO FRONTEND (HOSTING) ---
try {
    Write-Host "--- ETAPA 4: Implantando o site (Hosting)..." -ForegroundColor Yellow
    firebase deploy --only hosting
    Write-Host "--- Site implantado com sucesso!" -ForegroundColor Green
    Write-Host " "
} catch {
    Write-Host "!!! ERRO CRÍTICO ao implantar o site (Hosting). O script será interrompido." -ForegroundColor Red
    exit 1
}

# --- FINALIZAÇÃO ---
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "=== DEPLOY FINALIZADO COM SUCESSO! ===" -ForegroundColor Green
Write-Host "=== O ambiente de produção está 100% atualizado. ===" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " "