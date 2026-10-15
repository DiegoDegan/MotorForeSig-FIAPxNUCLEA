import subprocess
import sys
import os

# Resolve os caminhos a partir da localização deste script
base_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(base_dir)

scripts = [
    os.path.join(base_dir, "scripts", "limpeza.py"),
    os.path.join(base_dir, "scripts", "extrair_metricas_grafo.py"),
    os.path.join(base_dir, "scripts", "montar_base_modelagem.py"),
    os.path.join(base_dir, "scripts", "atualizar_politicas_dinamicas.py"),
    os.path.join(base_dir, "core", "model_trainer.py"),
    os.path.join(base_dir, "scripts", "pipeline_operacional.py")
]

# Tenta localizar o executável do python no ambiente virtual (.venv no Windows ou Linux/macOS)
venv_win = os.path.join(root_dir, ".venv", "Scripts", "python.exe")
venv_unix = os.path.join(root_dir, ".venv", "bin", "python")

if os.path.exists(venv_win):
    python_exe = venv_win
elif os.path.exists(venv_unix):
    python_exe = venv_unix
else:
    python_exe = sys.executable

print("="*60)
print("INICIANDO ORQUESTRAÇÃO DO PIPELINE MFS (END-TO-END)")
print("="*60)

for script in scripts:
    if not os.path.exists(script):
        print(f"\n[AVISO] Script não encontrado: {script}. Pulando...")
        continue
        
    print(f"\n>>> Executando: {os.path.basename(script)} ...")
    result = subprocess.run([python_exe, script], cwd=root_dir)
    if result.returncode != 0:
        print(f"\n[ERRO CRÍTICO] O script {os.path.basename(script)} falhou! Abortando a esteira.")
        sys.exit(1)
        
print("\n" + "="*60)
print("TODAS AS ETAPAS FORAM EXECUTADAS COM SUCESSO! IA ATUALIZADA.")
print("="*60)
