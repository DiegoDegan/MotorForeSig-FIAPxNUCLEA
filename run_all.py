import subprocess
import sys
import os

scripts = [
    "backend/scripts/limpeza.py",
    "backend/scripts/upload_neo4j.py",
    "backend/scripts/extrair_metricas_grafo.py",
    "backend/scripts/get_bacen_data.py",
    "backend/scripts/montar_base_modelagem.py",
    "backend/scripts/atualizar_politicas_dinamicas.py",
    "backend/core/model_trainer.py",
    "backend/scripts/pipeline_operacional.py"
]

python_exe = os.path.join(".venv", "Scripts", "python.exe")

print("="*60)
print("INICIANDO RECAPITULAÇÃO TOTAL DO MOTOR MFS (END-TO-END)")
print("="*60)

for script in scripts:
    print(f"\n>>> Executando: {script} ...")
    result = subprocess.run([python_exe, script])
    if result.returncode != 0:
        print(f"\n[ERRO CRÍTICO] O script {script} falhou! Abortando a esteira.")
        sys.exit(1)
        
print("\n" + "="*60)
print("TODAS AS ETAPAS FORAM EXECUTADAS COM SUCESSO! A IA ESTÁ TREINADA COM A ECONOMIA REAL.")
print("="*60)
