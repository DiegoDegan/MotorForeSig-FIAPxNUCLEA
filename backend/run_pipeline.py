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

def verificar_e_sincronizar_neo4j(python_exe: str, root_dir: str, base_dir: str):
    """
    Sincronização Inteligente com Neo4j:
    - Se o Neo4j estiver online e sem dados, executa upload_neo4j.py automaticamente.
    - Se o Neo4j estiver online e já populado, pula o upload para economizar tempo.
    - Se o Neo4j estiver offline/inacessível, loga aviso e permite que o próximo
      passo (extrair_metricas_grafo.py) utilize o fallback nativo em NetworkX.
    """
    print("\n>>> [Smart Sync] Checando disponibilidade e status da base Neo4j...")
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(root_dir, ".env"))
    except Exception:
        pass

    neo4j_uri = os.getenv("NEO4J_URI")
    neo4j_user = os.getenv("NEO4J_USER")
    neo4j_pass = os.getenv("NEO4J_PASSWORD")

    if not all([neo4j_uri, neo4j_user, neo4j_pass]):
        print("    [AVISO] Credenciais do Neo4j não configuradas no .env. A esteira utilizará o fallback local NetworkX.")
        return

    try:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_pass), connection_timeout=3.0)
        driver.verify_connectivity()
        
        with driver.session() as session:
            result = session.run("MATCH (e:Empresa) RETURN count(e) AS total LIMIT 1")
            record = result.single()
            total_nodes = record["total"] if record else 0
        driver.close()

        if total_nodes > 0:
            print(f"    [INFO] Neo4j conectado e já populado ({total_nodes} empresas registradas). Ingestão redundante ignorada.")
        else:
            print("    [INFO] Neo4j conectado, porém sem transações. Executando upload_neo4j.py automaticamente...")
            upload_script = os.path.join(base_dir, "scripts", "upload_neo4j.py")
            if os.path.exists(upload_script):
                res = subprocess.run([python_exe, upload_script], cwd=root_dir)
                if res.returncode == 0:
                    print("    [SUCESSO] Ingestão no Neo4j finalizada com êxito!")
                else:
                    print("    [AVISO] Ingestão no Neo4j retornou código diferente de zero. A esteira seguirá com fallback.")
            else:
                print(f"    [AVISO] Script {upload_script} não encontrado.")
    except Exception as e:
        print(f"    [AVISO] Neo4j offline ou inacessível ({e}). Pulando carga (a esteira usará engine local NetworkX).")

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
        
    # Após a limpeza higienizar os CSVs brutos, checar se o Neo4j precisa ser populado
    if os.path.basename(script) == "limpeza.py":
        verificar_e_sincronizar_neo4j(python_exe, root_dir, base_dir)
        
print("\n" + "="*60)
print("TODAS AS ETAPAS FORAM EXECUTADAS COM SUCESSO! IA ATUALIZADA.")
print("="*60)
