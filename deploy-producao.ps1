# =============================================================================
# === SCRIPT DE DEPLOY COMPLETO E SEGURO PARA PRODUÇÃO (FHT SISTEMAS) ===
# =============================================================================
# Este script implanta o projeto em etapas para evitar erros de cota de CPU:
# 1. Implanta as regras de segurança do Firestore e Storage.
# 2. Implanta as funções "seguras" em lotes.
# 3. Implanta as 5 funções "críticas" individualmente, com pausas.
# 4. Implanta o frontend (Hosting).
# =============================================================================

# Se qualquer comando falhar, o script para imediatamente.
$ErrorActionPreference = "Stop"

# Início do processo
Write-Host " "
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "=== INICIANDO DEPLOY COMPLETO PARA PRODUÇÃO ===" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " "

# --- ETAPA 1: DEPLOY DAS REGRAS DE SEGURANÇA ---
Write-Host "--- ETAPA 1 de 4: Implantando regras do Firestore e Storage..." -ForegroundColor Yellow
firebase deploy --only "firestore,storage"
Write-Host "--- Regras implantadas com sucesso!" -ForegroundColor Green
Write-Host " "
Start-Sleep -Seconds 5

# --- ETAPA 2: DEPLOY DAS FUNÇÕES "SEGURAS" EM LOTES ---
Write-Host "--- ETAPA 2 de 4: Implantando funções seguras em lotes..." -ForegroundColor Yellow

# Lote A: Funções de Registro e Gestão de Usuários
Write-Host "   -> Lote A: Funções de Registro e Gestão de Usuários..." -ForegroundColor Cyan
firebase deploy --only "functions:finalizeRegistration,functions:createStaffUser,functions:confirmUserSetup,functions:sendDoctorInvitation,functions:approveDoctor,functions:onUserWrittenSetClaims"

# Lote B: Funções Administrativas e de Manutenção
Write-Host "   -> Lote B: Funções Administrativas e de Manutenção..." -ForegroundColor Cyan
firebase deploy --only "functions:setAdminClaim,functions:setHospitalManagerRole,functions:associateDoctorToUnit,functions:searchAssociatedDoctors,functions:migrateDoctorProfilesToUsers,functions:correctServiceTypeCapitalization"

# Lote C: Funções de Geração de Documentos (PDF) e Ponto
Write-Host "   -> Lote C: Funções de Geração de Documentos e Ponto..." -ForegroundColor Cyan
firebase deploy --only "functions:generateContractPdf,functions:generatePrescriptionPdf,functions:generateDocumentPdf,functions:registerTimeRecord,functions:registerCheckout"

# Lote D: Funções de Agendamentos e Miscelânea
Write-Host "   -> Lote D: Funções de Agendamentos e Miscelânea..." -ForegroundColor Cyan
firebase deploy --only "functions:createAppointment,functions:createConsultationRoom,functions:createTelemedicineRoom,functions:onUserDeletedCleanup"

Write-Host "--- Funções seguras implantadas com sucesso!" -ForegroundColor Green
Write-Host " "
Start-Sleep -Seconds 5

# --- ETAPA 3: DEPLOY DAS FUNÇÕES "CRÍTICAS" (INDIVIDUALMENTE) ---
Write-Host "--- ETAPA 3 de 4: Implantando funções críticas (uma por uma)..." -ForegroundColor Magenta

Write-Host "   -> Implantando 1/5 (Crítica): findMatchesOnShiftRequirementWrite..." -ForegroundColor Magenta
firebase deploy --only functions:findMatchesOnShiftRequirementWrite
Write-Host "      ...Sucesso!" -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host "   -> Implantando 2/5 (Crítica): onContractFinalizedUpdateRequirement..." -ForegroundColor Magenta
firebase deploy --only functions:onContractFinalizedUpdateRequirement
Write-Host "      ...Sucesso!" -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host "   -> Implantando 3/5 (Crítica): onContractFinalizedLinkDoctor..." -ForegroundColor Magenta
firebase deploy --only functions:onContractFinalizedLinkDoctor
Write-Host "      ...Sucesso!" -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host "   -> Implantando 4/5 (Crítica): onShiftRequirementDelete..." -ForegroundColor Magenta
firebase deploy --only functions:onShiftRequirementDelete
Write-Host "      ...Sucesso!" -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host "   -> Implantando 5/5 (Crítica): onTimeSlotDelete..." -ForegroundColor Magenta
firebase deploy --only functions:onTimeSlotDelete
Write-Host "      ...Sucesso!" -ForegroundColor Green

Write-Host "--- Funções críticas implantadas com sucesso!" -ForegroundColor Green
Write-Host " "
Start-Sleep -Seconds 5

# --- ETAPA 4: DEPLOY DO FRONTEND (HOSTING) ---
Write-Host "--- ETAPA 4 de 4: Implantando o site (Hosting)..." -ForegroundColor Yellow
firebase deploy --only hosting
Write-Host "--- Site implantado com sucesso!" -ForegroundColor Green
Write-Host " "

# --- FINALIZAÇÃO ---
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "=== DEPLOY FINALIZADO COM SUCESSO! ===" -ForegroundColor Green
Write-Host "=== O ambiente de produção está 100% atualizado. ===" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " "