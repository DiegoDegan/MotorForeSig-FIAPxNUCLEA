import os
import docx

files = [
    r"c:\Users\Degan\Documents\Antigravity\Nuclea\fluxo_ingris\1.ExplicacaoColunas_Risco Conectado_Grafos.docx",
    r"c:\Users\Degan\Documents\Antigravity\Nuclea\fluxo_ingris\2.ExplicacaoColunas_Risco Temporal.docx",
    r"c:\Users\Degan\Documents\Antigravity\Nuclea\fluxo_ingris\3.ExplicacaoColunas_Previsão de Default_PD.docx",
    r"c:\Users\Degan\Documents\Antigravity\Nuclea\fluxo_ingris\4.ExplicacaoColunas_Politica_rejeicao_automatica.docx"
]

with open('output_docs.txt', 'w', encoding='utf-8') as out:
    for f in files:
        out.write(f"\n================ LENDO: {os.path.basename(f)} ================\n")
        try:
            doc = docx.Document(f)
            for para in doc.paragraphs:
                if para.text.strip():
                    out.write(para.text + "\n")
        except Exception as e:
            out.write(f"Erro ao ler {f}: {e}\n")
