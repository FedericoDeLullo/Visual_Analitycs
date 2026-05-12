import pandas as pd

# 1. Carica il dataset originale
df = pd.read_csv('FC26_20250921.csv', low_memory=False)

# 2. Filtra: Solo giocatori Under 25 (Escludendo i portieri)
df_filtered = df[(df['age'] <= 25) & (~df['player_positions'].str.contains('GK', na=False))]
df_filtered = df_filtered.sort_values(by='potential', ascending=False).head(2000)

# 3. AGGIUNTA 'nationality_name' ALLE COLONNE
colonne_scelte = [
    'player_id', 'short_name', 'age', 'nationality_name', 'player_positions', 'overall', 'potential', 
    'value_eur', 'wage_eur', 'preferred_foot', 'pace', 'shooting', 'passing', 
    'dribbling', 'defending', 'physic', 'height_cm', 'weight_kg', 'league_name'
]
df_final = df_filtered[colonne_scelte]

# 4. Salva il nuovo dataset
df_final.to_csv('dataset_va.csv', index=False)
print("Dataset creato con successo! Nazionalità inclusa.")