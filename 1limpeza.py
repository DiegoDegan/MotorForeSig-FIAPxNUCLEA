import pandas as pd

# 1. Carga
df_boletos = pd.read_csv('data/base_boletos_fiap.csv')
df_aux = pd.read_csv('data/base_auxiliar_fiap.csv')

# 2. Limpeza: Converter datas
df_boletos['dt_vencimento'] = pd.to_datetime(df_boletos['dt_vencimento'])
df_boletos['dt_pagamento'] = pd.to_datetime(df_boletos['dt_pagamento'])

# 3. Engenharia: Marcar o que é Inadimplência (Default)
# Se não pagou ou pagou com mais de 60 dias de atraso
df_boletos['is_default'] = ((df_boletos['dt_pagamento'].isna()) | 
                            ((df_boletos['dt_pagamento'] - df_boletos['dt_vencimento']).dt.days > 60)).astype(int)

# 4. Exportar para o Neo4j
# Agora o arquivo está 'puro' para virar nós e relações
df_boletos.to_csv('data/base_boletos_LIMPA.csv', index=False)

