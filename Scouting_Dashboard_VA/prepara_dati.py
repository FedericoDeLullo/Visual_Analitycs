import pandas as pd

# 1. Carica il dataset originale
df = pd.read_csv('FC26_20250921.csv')

# 2. Filtra: Solo giocatori Under 25 con un potenziale alto (per simulare i talenti)
# Rimuoviamo i portieri per ora, perché sballerebbero la PCA sulle statistiche di movimento
df_filtered = df[(df['age'] <= 25) & (~df['player_positions'].str.contains('GK', na=False))]
df_filtered = df_filtered.sort_values(by='potential', ascending=False).head(2000)

# 3. Seleziona ESATTAMENTE 20 colonne (Dimensioni)
colonne_scelte = [
    'player_id', 'short_name', 'age', 'player_positions', 'overall', 'potential', 
    'value_eur', 'wage_eur', 'preferred_foot', 'pace', 'shooting', 'passing', 
    'dribbling', 'defending', 'physic', 'height_cm', 'weight_kg', 
    'club_name', 'league_name', 'player_face_url'
]
df_final = df_filtered[colonne_scelte]

# 4. Salva il nuovo dataset
df_final.to_csv('dataset_va.csv', index=False)
print(f"Dataset creato! Righe: {df_final.shape[0]}, Colonne: {df_final.shape[1]}")
print(f"Indice AS: {df_final.shape[0] * df_final.shape[1]}")