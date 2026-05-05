import streamlit as st
import pandas as pd
import altair as alt
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import plotly.express as px

# ==========================================
# 1. CONFIGURAZIONE PAGINA
# ==========================================
st.set_page_config(page_title="FC 26 Football Scout", layout="wide")
st.title("⚽ FC 26 Smart Scouting - Visual Analytics")

# ==========================================
# 2. CARICAMENTO E PREPARAZIONE DATI
# ==========================================
@st.cache_data # Memorizza i dati in cache per non ricaricare il file ad ogni click
def load_and_filter_data():
    # Carichiamo il dataset originale
    df = pd.read_csv('FC26_20250921.csv', low_memory=False)
    
    # Le 22 colonne (dimensioni) che ci servono per il progetto
    cols_to_keep = [
        'short_name', 'player_positions', 'age', 'league_name', 
        'value_eur', 'wage_eur', 'potential', 'overall',
        'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
        'attacking_crossing', 'attacking_finishing', 'skill_dribbling', 
        'movement_acceleration', 'movement_sprint_speed', 'power_stamina', 
        'mentality_vision', 'defending_standing_tackle'
    ]
    
    df = df[cols_to_keep].dropna() # Rimuoviamo le righe con valori mancanti
    
    # I 5 campionati principali
    top_leagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']
    
    # Applichiamo i filtri: no portieri, under 25, solo top 5 leghe
    df_filtered = df[
        (~df['player_positions'].str.contains('GK', na=False)) & 
        (df['age'] <= 25) & 
        (df['league_name'].isin(top_leagues))
    ].copy()
    
    return df_filtered

# Esecuzione del caricamento
df = load_and_filter_data()

# Calcolo dell'Indice AS per controllo
rows, cols = df.shape
as_index = rows * cols

# Mostriamo i risultati a schermo
st.write("### Controllo Dati e Indice AS")
st.write(f"Giocatori filtrati (tuple): **{rows}**")
st.write(f"Statistiche selezionate (dimensioni): **{cols}**")
st.write(f"**Indice AS calcolato:** **{as_index}** (Deve essere tra 10.000 e 50.000)")
st.dataframe(df.head()) # Mostra le prime 5 righe

# ==========================================
# 3. MOTORE ANALITICO (PCA)
# ==========================================
st.write("---")
st.write("## 1. Motore Analitico: Dimensionality Reduction (PCA)")

# Selezioniamo SOLO le colonne con le statistiche tecniche da comprimere
stats_cols = [
    'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
    'attacking_crossing', 'attacking_finishing', 'skill_dribbling', 
    'movement_acceleration', 'movement_sprint_speed', 'power_stamina', 
    'mentality_vision', 'defending_standing_tackle'
]

# Standardizzazione dei dati (Obbligatoria come da slide del prof!)
scaler = StandardScaler()
df_scaled = scaler.fit_transform(df[stats_cols])

# Calcoliamo la PCA per ridurre a 2 dimensioni (X e Y)
pca = PCA(n_components=2)
pca_result = pca.fit_transform(df_scaled)

# Aggiungiamo le nuove coordinate matematiche al nostro dataset
df['PCA1'] = pca_result[:, 0]
df['PCA2'] = pca_result[:, 1]

# Mostriamo un feedback a schermo
st.success("✅ PCA calcolata con successo sui dati standardizzati!")
varianza_spiegata = sum(pca.explained_variance_ratio_) * 100
st.write(f"La PCA1 e PCA2 spiegano insieme il **{varianza_spiegata:.2f}%** della varianza totale delle statistiche.")
st.dataframe(df[['short_name', 'PCA1', 'PCA2']].head())

# ==========================================
# 4. DASHBOARD INTERATTIVA E COORDINATA
# ==========================================
st.write("---")
st.write("## 2. Dashboard Interattiva e Coordinata")
st.markdown("💡 *Usa il mouse per disegnare un rettangolo di selezione (Brush) su uno dei due grafici per filtrare i giocatori. I grafici sono coordinati bidirezionalmente!*")

# Definiamo l'interazione: un intervallo rettangolare (il Lasso/Brush)
brush = alt.selection_interval(name="brush")

# GRAFICO 1: SCATTERPLOT PCA
pca_chart = alt.Chart(df).mark_circle(size=60).encode(
    x=alt.X('PCA1', title='PC1 (Attacco/Velocità ->)'),
    y=alt.Y('PCA2', title='PC2 (Difesa/Fisico ->)'),
    
    # LA MAGIA: Se il punto è nel 'brush' mantieni il colore, altrimenti fallo grigio!
    color=alt.condition(brush, 
                        alt.Color('overall:Q', scale=alt.Scale(scheme='redyellowgreen'), title='Overall'), 
                        alt.value('lightgray')),
    
    # Riduciamo l'opacità dei punti non selezionati per far risaltare gli altri
    opacity=alt.condition(brush, alt.value(0.8), alt.value(0.1)),
    tooltip=['short_name', 'player_positions', 'overall', 'age', 'value_eur']
).add_params(
    brush # Aggiungiamo lo strumento al grafico
).properties(
    height=450,
    title="1. Mappa dei Talenti (PCA)"
)

# GRAFICO 2: BUBBLE CHART ECONOMICO
eco_chart = alt.Chart(df).mark_circle().encode(
    x=alt.X('value_eur', title='Valore di Mercato (€)'),
    y=alt.Y('wage_eur', title='Stipendio Settimanale (€)'),
    size=alt.Size('overall:Q', scale=alt.Scale(range=[20, 300]), title='Overall'),
    
    # STESSA LOGICA: Reagisce allo stesso identico 'brush' del grafico 1
    color=alt.condition(brush, alt.value('#1f77b4'), alt.value('lightgray')),
    opacity=alt.condition(brush, alt.value(0.7), alt.value(0.1)),
    tooltip=['short_name', 'value_eur', 'wage_eur', 'overall', 'age']
).add_params(
    brush # Aggiungiamo lo strumento anche qui (Coordinamento Bidirezionale!)
).properties(
    height=450,
    title="2. Analisi Economica"
)

# UNIONE DEI GRAFICI
# Invece delle colonne di Streamlit, usiamo l'operatore "|" di Altair 
# per incollare i grafici orizzontalmente e farli comunicare nel browser.
dashboard_coordinata = (pca_chart | eco_chart).resolve_scale(
    color='independent', # Mantiene le scale di colore separate
    size='independent'
)

# ==========================================
# CATTURA DELLA SELEZIONE E ANALITICA AVANZATA
# ==========================================

# 1. Mostriamo la dashboard e "ascoltiamo" l'evento di selezione (on_select)
event = st.altair_chart(dashboard_coordinata, use_container_width=True, on_select="rerun")

st.write("---")
st.write("## 3. Analitica Avanzata (Dettaglio Cluster)")

# 2. Logica matematica: Copiamo il dataset e lo filtriamo in base al "Brush"
selected_df = df.copy()

# Se l'utente ha disegnato un rettangolo, estraiamo i limiti (min e max di X e Y)
if event is not None and event.selection and 'brush' in event.selection:
    bounds = event.selection['brush']
    
    # Controlliamo se l'utente ha usato il brush sulla PCA o sul grafico Economico
    if 'PCA1' in bounds:
        selected_df = selected_df[
            (selected_df['PCA1'] >= bounds['PCA1'][0]) & (selected_df['PCA1'] <= bounds['PCA1'][1]) &
            (selected_df['PCA2'] >= bounds['PCA2'][0]) & (selected_df['PCA2'] <= bounds['PCA2'][1])
        ]
    elif 'value_eur' in bounds:
        selected_df = selected_df[
            (selected_df['value_eur'] >= bounds['value_eur'][0]) & (selected_df['value_eur'] <= bounds['value_eur'][1]) &
            (selected_df['wage_eur'] >= bounds['wage_eur'][0]) & (selected_df['wage_eur'] <= bounds['wage_eur'][1])
        ]

# 3. Disegnamo i grafici finali SOLO se c'è una selezione attiva
if len(selected_df) == len(df) or len(selected_df) == 0:
    st.info("👆 Disegna un rettangolo su uno dei grafici qui sopra per innescare l'analitica e sbloccare il profilo tecnico e la previsione di crescita.")
else:
    st.success(f"🎯 Cluster isolato! Modelli matematici calcolati su **{len(selected_df)}** giocatori.")
    
    col3, col4 = st.columns(2)
    
    # ==========================================
    # GRAFICO 3: ETÀ VS POTENZIALE (Con Regressione)
    # ==========================================
    with col3:
        # Prepariamo la base del grafico usando l'età come asse X
        base = alt.Chart(selected_df).encode(
            x=alt.X('age:Q', title='Età (Anni)', scale=alt.Scale(domain=[16, 26]))
        )
        
        # Le barre mostrano il potenziale medio per quell'età
        bar_age = base.mark_bar(opacity=0.6, color="#2ca02c", size=20).encode(
            y=alt.Y('mean(potential):Q', title='Potenziale Medio Stimato', scale=alt.Scale(domain=[60, 100]))
        )
        
        # IL CALCOLO ANALITICO: Altair calcola la regressione lineare da solo!
        line_reg = base.mark_line(color='red', strokeWidth=3).encode(
            y=alt.Y('potential:Q')
        ).transform_regression('age', 'potential')
        
        chart_age = (bar_age + line_reg).properties(height=350, title="Curva di Crescita (Regressione Lineare)")
        st.altair_chart(chart_age, use_container_width=True)
        
    # ==========================================
    # GRAFICO 4: IL RADAR CHART CON PLOTLY
    # ==========================================
    with col4:
        import plotly.express as px
        
        # Facciamo la media matematica esatta delle statistiche del cluster
        radar_cols = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic']
        mean_stats = selected_df[radar_cols].mean()
        
        # Costruiamo il Radar Chart
        fig = px.line_polar(
            r=mean_stats.values, 
            theta=[c.capitalize() for c in radar_cols], 
            line_close=True,
            range_r=[0, 100] # Scala fissa da 0 a 100
        )
        
        # Coloriamo il poligono
        fig.update_traces(fill='toself', line_color='#1f77b4', fillcolor='rgba(31, 119, 180, 0.4)')
        fig.update_layout(title="Profilo Tecnico Medio (Archetipo)", margin=dict(l=40, r=40, t=40, b=40))
        
        st.plotly_chart(fig, use_container_width=True)