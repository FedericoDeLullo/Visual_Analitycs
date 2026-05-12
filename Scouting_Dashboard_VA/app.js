let globalData = [];
const chartControls = {
    pca: { svg: null, zoom: null, brushGroup: null, brush: null },
    eco: { svg: null, zoom: null, brushGroup: null, brush: null }
};

// --- COSTANTI GLOBALI E MAPPA CAMPIONATI ---
const mappaCampionati = {
    "Serie A": "Serie A (Italia)",
    "Serie B": "Serie B (Italia)",
    "Bundesliga": "Bundesliga (Germania)",
    "2. Bundesliga": "2. Bundesliga (Germania)",
    "Ligue 1": "Ligue 1 (Francia)",
    "Ligue 2": "Ligue 2 (Francia)",
    "Premier League": "Premier League (Inghilterra)",
    "Championship": "Championship (Inghilterra)",
    "League One": "League One (Inghilterra)",
    "League Two": "League Two (Inghilterra)",
    "Eredivisie": "Eredivisie (Olanda)",
    "La Liga": "La Liga (Spagna)",
    "La Liga 2": "La Liga 2 (Spagna)",
    "Liga Profesional de Fútbol": "Liga Profesional de Futbol (Argentina)",
    "Primeira Liga": "Primeira Liga (Portogallo)",
    "Süper Lig": "Super Lig (Turchia)"
};

// Tavolozza Neon per il Dark Theme
const colorScale = d3.scaleOrdinal()
    .domain([...Object.values(mappaCampionati), "ALTRI CAMPIONATI"])
    .range([
        "#0ea5e9", "#38bdf8", // Serie A, Serie B (Ciano Elettrico)
        "#ef4444", "#f87171", // Bundes, 2.Bundes (Rosso Neon)
        "#f97316", "#fb923c", // Ligue 1, L2 (Arancio Acceso)
        "#22c55e", "#4ade80", "#86efac", "#bbf7d0", // Inghilterra (Verde Matrix)
        "#eab308", // Eredivisie (Giallo Sole)
        "#a855f7", "#c084fc", // La Liga, La Liga 2 (Viola Fluo)
        "#06b6d4", // Argentina (Azzurro)
        "#10b981", // Portogallo (Smeraldo)
        "#e11d48", // Turchia (Cremisi)
        "#475569"  // ALTRI CAMPIONATI (Grigio Scuro)
    ]);

// 1. CARICAMENTO E SETUP
d3.csv("dataset_va.csv").then(data => {
    data.forEach(d => {
        d.age = +d.age || 0; d.overall = +d.overall || 0; d.potential = +d.potential || 0;
        d.value_eur = +d.value_eur || 0; d.wage_eur = +d.wage_eur || 0;
        d.pace = +d.pace || 0; d.shooting = +d.shooting || 0; d.passing = +d.passing || 0;
        d.dribbling = +d.dribbling || 0; d.defending = +d.defending || 0; d.physic = +d.physic || 0;
        
        d.original_league = d.league_name; 
        d.league_name = mappaCampionati[d.league_name] || "ALTRI CAMPIONATI";
        d.isFiltered = true; 
    });
    globalData = data;

    calcolaPCA();
    disegnaMappaPCA();
    disegnaScatterplotEconomico(); 
    disegnaRadarChart(globalData);
    disegnaBarChart(globalData);
    
    inizializzaBottoniVista();
    inizializzaFiltri();
    disegnaLegenda();
    gestisciSidebar();
    gestisciMenuFlottante();
    
}).catch(e => console.error("Errore Caricamento Dati:", e));

function calcolaPCA() {
    let m = globalData.map(d => [d.pace, d.shooting, d.passing, d.dribbling, d.defending, d.physic]);
    let v = PCA.getEigenVectors(m);
    let p = PCA.computeAdjustedData(m, v[0], v[1]);
    globalData.forEach((d, i) => { d.pc1 = p.adjustedData[0][i]; d.pc2 = p.adjustedData[1][i]; });
}

// 2. COORDINAMENTO GLOBALE (DARK THEME)
function aggiornaVisteCoordinate(giocatoriSelezionati) {
    const ids = giocatoriSelezionati.map(d => d.player_id);
    const hasSel = ids.length > 0;

    d3.selectAll(".dot, .eco-dot")
        .classed("selected", d => hasSel && ids.includes(d.player_id))
        .attr("opacity", d => !d.isFiltered ? 0.05 : (!hasSel ? 0.9 : (ids.includes(d.player_id) ? 1 : 0.15)))
        .attr("fill", d => {
            if (!d.isFiltered) return "#334155"; // Grigio scuro per esclusi (Dark Mode)
            let coloreBase = colorScale(d.league_name); 
            if (!hasSel) return coloreBase; 
            return ids.includes(d.player_id) ? coloreBase : "#334155"; 
        })
        .attr("r", d => hasSel && ids.includes(d.player_id) ? 6.5 : 4.5)
        .attr("stroke", d => hasSel && ids.includes(d.player_id) ? "#ffffff" : "#0f172a")
        .attr("stroke-width", d => hasSel && ids.includes(d.player_id) ? 2 : 0.5)
        .style("pointer-events", d => {
            if (!d.isFiltered) return "none"; 
            if (hasSel && !ids.includes(d.player_id)) return "none"; 
            return "all"; 
        });

    d3.selectAll(".dot, .eco-dot").filter(d => d.isFiltered).raise();
    if (hasSel) d3.selectAll(".dot.selected, .eco-dot.selected").raise();

    disegnaTabella(giocatoriSelezionati);
    
    let datiAttivi = hasSel ? giocatoriSelezionati : globalData.filter(d => d.isFiltered);
    disegnaRadarChart(datiAttivi);
    disegnaBarChart(datiAttivi);
}

// 3. MOTORE FILTRI (Senza Piede Preferito)
function inizializzaFiltri() {
    const campionatiSelezionabili = [...Object.values(mappaCampionati), "ALTRI CAMPIONATI"];
    const menuCampionati = d3.select("#filter-league");
    menuCampionati.selectAll("option:not([value='All'])").remove();
    campionatiSelezionabili.forEach(lega => {
        menuCampionati.append("option").attr("value", lega).text(lega);
    });

    const nazionalitaUniche = [...new Set(globalData.map(d => d.nationality_name))].filter(n => n && n.trim() !== "").sort();
    const menuNazionalita = d3.select("#filter-nationality");
    menuNazionalita.selectAll("option:not([value='All'])").remove();
    nazionalitaUniche.forEach(naz => {
        menuNazionalita.append("option").attr("value", naz).text(naz);
    });

    d3.select("#filter-age").on("input", function() { d3.select("#age-val").text(this.value); });
    d3.select("#btn-apply-filters").on("click", applicaFiltri);
}

function applicaFiltri() {
    const maxAge = +d3.select("#filter-age").property("value");
    const role = d3.select("#filter-role").property("value");
    const league = d3.select("#filter-league").property("value");
    const nationality = d3.select("#filter-nationality").property("value");
    
    const minVal = +d3.select("#filter-val-min").property("value") || 0;
    const maxVal = +d3.select("#filter-val-max").property("value") || 9999999999;
    const minWage = +d3.select("#filter-wage-min").property("value") || 0;
    const maxWage = +d3.select("#filter-wage-max").property("value") || 9999999999;

    globalData.forEach(d => {
        let passAge = d.age <= maxAge;
        let passVal = d.value_eur >= minVal && d.value_eur <= maxVal;
        let passWage = d.wage_eur >= minWage && d.wage_eur <= maxWage;
        let passLeague = (league === "All") || (d.league_name === league);
        let passNat = (nationality === "All") || (d.nationality_name === nationality);
        
        let passRole = false;
        if (role === "All") passRole = true;
        else if (role === "MACRO_ATT") passRole = ["ST","RW","LW","CF"].some(r => d.player_positions.includes(r));
        else if (role === "MACRO_MID") passRole = ["CM","CAM","CDM","RM","LM"].some(r => d.player_positions.includes(r));
        else if (role === "MACRO_DEF") passRole = ["CB","RB","LB","RWB","LWB"].some(r => d.player_positions.includes(r));
        else passRole = d.player_positions.includes(role); 

        d.isFiltered = passAge && passVal && passWage && passLeague && passRole && passNat;
    });

    if(chartControls.pca.brush) chartControls.pca.brushGroup.call(chartControls.pca.brush.move, null);
    if(chartControls.eco.brush) chartControls.eco.brushGroup.call(chartControls.eco.brush.move, null);
    
    aggiornaVisteCoordinate([]);
    d3.select("#table-wrapper").html("<div class='empty-state'>Usa lo strumento Lazo per visualizzare i giocatori.</div>");
}

d3.select("#btn-reset").on("click", function() {
    document.getElementById("filter-age").value = 25; d3.select("#age-val").text(25);
    document.getElementById("filter-role").value = "All";
    document.getElementById("filter-league").value = "All";
    document.getElementById("filter-nationality").value = "All";
    document.getElementById("filter-val-min").value = "";
    document.getElementById("filter-val-max").value = "";
    document.getElementById("filter-wage-min").value = "";
    document.getElementById("filter-wage-max").value = "";

    globalData.forEach(d => d.isFiltered = true);
    
    if(chartControls.pca.svg) chartControls.pca.svg.transition().duration(500).call(chartControls.pca.zoom.transform, d3.zoomIdentity);
    if(chartControls.eco.svg) chartControls.eco.svg.transition().duration(500).call(chartControls.eco.zoom.transform, d3.zoomIdentity);
    if(chartControls.pca.brush) chartControls.pca.brushGroup.call(chartControls.pca.brush.move, null);
    if(chartControls.eco.brush) chartControls.eco.brushGroup.call(chartControls.eco.brush.move, null);

    aggiornaVisteCoordinate([]);
});


// --- 4. MAPPA DEI TALENTI (PCA) ---
function disegnaMappaPCA() {
    const c = d3.select("#svg-pca"), w = c.node().getBoundingClientRect().width, h = c.node().getBoundingClientRect().height;
    const svg = c.append("svg").attr("width","100%").attr("height","100%").attr("viewBox",`0 0 ${w} ${h}`);
    const m = {t:20, r:30, b:45, l:50}, iW = w - m.l - m.r, iH = h - m.t - m.b;
    const g = svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
    
    const xS = d3.scaleLinear().domain(d3.extent(globalData, d=>d.pc1)).range([0, iW]);
    const yS = d3.scaleLinear().domain(d3.extent(globalData, d=>d.pc2)).range([iH, 0]); 

    // Colori assi per tema scuro
    const xA = g.append("g").attr("transform",`translate(0,${iH})`).call(d3.axisBottom(xS));
    xA.selectAll("path, line").attr("stroke", "#334155"); xA.selectAll("text").attr("fill", "#94a3b8");
    g.append("text").attr("x",iW/2).attr("y",iH+35).style("text-anchor","middle").style("font-size","12px").style("fill","#94a3b8").text("PC1 (Difensivo ⬅ ➡ Offensivo)");

    const yA = g.append("g").call(d3.axisLeft(yS));
    yA.selectAll("path, line").attr("stroke", "#334155"); yA.selectAll("text").attr("fill", "#94a3b8");
    g.append("text").attr("transform","rotate(-90)").attr("x",-iH/2).attr("y",-35).style("text-anchor","middle").style("font-size","12px").style("fill","#94a3b8").text("PC2 (Fisico ⬅ ➡ Agile)");

    svg.append("defs").append("clipPath").attr("id","clip-pca").append("rect").attr("width",iW).attr("height",iH);
    const dG = g.append("g").attr("clip-path","url(#clip-pca)").append("g");
    let tt = d3.select(".sports-tooltip"); if(tt.empty()) tt = d3.select("body").append("div").attr("class","sports-tooltip");

    dG.selectAll(".dot").data(globalData).enter().append("circle").attr("class","dot")
        .attr("cx",d=>xS(d.pc1)).attr("cy",d=>yS(d.pc2)).attr("r",4.5).attr("opacity",0.9).attr("stroke","#0f172a").attr("stroke-width",0.5)
        .attr("fill", d => colorScale(d.league_name)) 
        .on("mouseover", function(e, d) {
            if(!d.isFiltered) return; 
            d3.select(this).attr("stroke","#ffffff").attr("stroke-width",2).attr("opacity",1).raise();
            tt.transition().duration(200).style("opacity",1);
            let etichettaLega = d.league_name === "ALTRI CAMPIONATI" ? `ALTRI (${d.original_league})` : d.league_name;
            tt.html(`NOME: <span>${d.short_name}</span><br/>NAZ: <span>${d.nationality_name || "N/A"}</span><br/>LEGA: <span>${etichettaLega}</span><br/>OVR: <span>${d.overall}</span>`);
        })
        .on("mousemove", e => tt.style("left",(e.pageX+15)+"px").style("top",(e.pageY-20)+"px"))
        .on("mouseleave", function(e, d) {
            let isS = d3.select(this).classed("selected");
            d3.select(this).attr("stroke", isS?"#ffffff":"#0f172a").attr("stroke-width", isS?2:0.5)
              .attr("opacity", d.isFiltered?(isS?1:(d3.selectAll(".selected").empty()?0.9:0.15)):0.05);
            if(!d3.selectAll(".selected").empty() && !isS) d3.selectAll(".selected").raise();
            tt.transition().duration(500).style("opacity",0);
        });

    const zoom = d3.zoom().scaleExtent([0.5,8]).on("zoom", e => { 
        dG.attr("transform",e.transform); 
        xA.call(d3.axisBottom(e.transform.rescaleX(xS))); xA.selectAll("path, line").attr("stroke", "#334155"); xA.selectAll("text").attr("fill", "#94a3b8");
        yA.call(d3.axisLeft(e.transform.rescaleY(yS))); yA.selectAll("path, line").attr("stroke", "#334155"); yA.selectAll("text").attr("fill", "#94a3b8");
    });
    const brush = d3.brush().extent([[0,0],[iW,iH]]).on("end", function(e) {
        if(!e.sourceEvent) return; if(!e.selection){ aggiornaVisteCoordinate([]); return; }
        const [[x0,y0],[x1,y1]] = e.selection, t = d3.zoomTransform(svg.node());
        aggiornaVisteCoordinate(globalData.filter(d => d.isFiltered && t.applyX(xS(d.pc1))>=x0 && t.applyX(xS(d.pc1))<=x1 && t.applyY(yS(d.pc2))>=y0 && t.applyY(yS(d.pc2))<=y1));
        d3.select(this).call(brush.move, null); 
    });

    const bG = g.append("g").attr("class","brush"); bG.call(brush);
    chartControls.pca = { svg, zoom, brushGroup: bG, brush };
    // Inizializza tutto SPENTO (Modalità Scroll di default)
    svg.on(".zoom", null); 
    bG.style("display","none");
}

// 5. SCATTERPLOT ECONOMICO (SymLog)
function disegnaScatterplotEconomico() {
    const c = d3.select("#svg-eco"), w = c.node().getBoundingClientRect().width, h = c.node().getBoundingClientRect().height;
    const svg = c.append("svg").attr("width","100%").attr("height","100%").attr("viewBox",`0 0 ${w} ${h}`);
    const m = {t:20, r:30, b:45, l:65}, iW = w - m.l - m.r, iH = h - m.t - m.b;
    const g = svg.append("g").attr("transform",`translate(${m.l},${m.t})`);
    
    const xS = d3.scaleSymlog().constant(10000).domain([0, d3.max(globalData, d=>d.value_eur)]).range([0, iW]);
    const yS = d3.scaleSymlog().constant(1000).domain([0, d3.max(globalData, d=>d.wage_eur)]).range([iH, 0]);
    const fmt = d => d>=1e6 ? "€"+(d/1e6).toFixed(1)+"M" : (d>=1e3 ? "€"+(d/1e3).toFixed(0)+"K" : "€"+d);

    const tickValuesX = [0, 100000, 1000000, 10000000, 50000000, 100000000];
    const tickValuesY = [0, 1000, 10000, 50000, 100000, 300000];

    const xA = g.append("g").attr("transform",`translate(0,${iH})`).call(d3.axisBottom(xS).tickValues(tickValuesX).tickFormat(fmt));
    xA.selectAll("path, line").attr("stroke", "#334155"); xA.selectAll("text").attr("fill", "#94a3b8");
    xA.append("text").attr("x",iW).attr("y",35).style("text-anchor","end").style("fill","#94a3b8").text("Valore (Scala Log) ▶");
    
    const yA = g.append("g").call(d3.axisLeft(yS).tickValues(tickValuesY).tickFormat(fmt));
    yA.selectAll("path, line").attr("stroke", "#334155"); yA.selectAll("text").attr("fill", "#94a3b8");
    yA.append("text").attr("transform","rotate(-90)").attr("x",0).attr("y",-45).style("text-anchor","end").style("fill","#94a3b8").text("Stipendio (Scala Log) ▶");

    svg.append("defs").append("clipPath").attr("id","clip-eco").append("rect").attr("width",iW).attr("height",iH);
    const dG = g.append("g").attr("clip-path","url(#clip-eco)").append("g");
    const tt = d3.select(".sports-tooltip");

    dG.selectAll(".eco-dot").data(globalData).enter().append("circle").attr("class","eco-dot")
        .attr("cx",d=>xS(d.value_eur)).attr("cy",d=>yS(d.wage_eur)).attr("r",4.5).attr("opacity",0.9).attr("stroke","#0f172a").attr("stroke-width",0.5)
        .attr("fill", d => colorScale(d.league_name))
        .on("mouseover", function(e, d) {
            if(!d.isFiltered) return; 
            d3.select(this).attr("stroke","#ffffff").attr("stroke-width",2).attr("opacity",1).raise();
            tt.transition().duration(200).style("opacity",1);
            let etichettaLega = d.league_name === "ALTRI CAMPIONATI" ? `ALTRI (${d.original_league})` : d.league_name;
            tt.html(`NOME: <span>${d.short_name}</span><br/>NAZ: <span>${d.nationality_name || "N/A"}</span><br/>LEGA: <span>${etichettaLega}</span><br/>VALORE: <span>${fmt(d.value_eur)}</span>`);
        })
        .on("mousemove", e => tt.style("left",(e.pageX+15)+"px").style("top",(e.pageY-20)+"px"))
        .on("mouseleave", function(e, d) {
            let isS = d3.select(this).classed("selected");
            d3.select(this).attr("stroke", isS?"#ffffff":"#0f172a").attr("stroke-width", isS?2:0.5)
              .attr("opacity", d.isFiltered?(isS?1:(d3.selectAll(".selected").empty()?0.9:0.15)):0.05);
            if(!d3.selectAll(".selected").empty() && !isS) d3.selectAll(".selected").raise();
            tt.transition().duration(500).style("opacity",0);
        });

    const zoom = d3.zoom().scaleExtent([0.5,10]).on("zoom", e => { 
        dG.attr("transform",e.transform); 
        xA.call(d3.axisBottom(e.transform.rescaleX(xS)).tickValues(tickValuesX).tickFormat(fmt)); xA.selectAll("path, line").attr("stroke", "#334155"); xA.selectAll("text").attr("fill", "#94a3b8");
        yA.call(d3.axisLeft(e.transform.rescaleY(yS)).tickValues(tickValuesY).tickFormat(fmt)); yA.selectAll("path, line").attr("stroke", "#334155"); yA.selectAll("text").attr("fill", "#94a3b8");
    });
    
    const brush = d3.brush().extent([[0,0],[iW,iH]]).on("end", function(e) {
        if(!e.sourceEvent) return; if(!e.selection){ aggiornaVisteCoordinate([]); return; }
        const [[x0,y0],[x1,y1]] = e.selection, t = d3.zoomTransform(svg.node());
        aggiornaVisteCoordinate(globalData.filter(d => d.isFiltered && t.applyX(xS(d.value_eur))>=x0 && t.applyX(xS(d.value_eur))<=x1 && t.applyY(yS(d.wage_eur))>=y0 && t.applyY(yS(d.wage_eur))<=y1));
        d3.select(this).call(brush.move, null); 
    });

    const bG = g.append("g").attr("class","brush"); bG.call(brush);
    chartControls.eco = { svg, zoom, brushGroup: bG, brush };
    // Inizializza tutto SPENTO (Modalità Scroll di default)
    svg.on(".zoom", null); 
    bG.style("display","none");
}

// 6. RADAR CHART E BAR CHART
function disegnaRadarChart(dati) {
    const c = d3.select("#svg-radar"); c.html(""); if (!dati.length) return c.html("<div class='empty-state'>Nessun dato.</div>");
    const w = c.node().getBoundingClientRect().width, h = c.node().getBoundingClientRect().height, r = Math.min(w,h)/2 - 35;
    const g = c.append("svg").attr("width","100%").attr("height","100%").attr("viewBox",`0 0 ${w} ${h}`).append("g").attr("transform",`translate(${w/2},${h/2})`);
    
    const m = [{a:"Vel",v:d3.mean(dati,d=>d.pace)}, {a:"Tir",v:d3.mean(dati,d=>d.shooting)}, {a:"Pas",v:d3.mean(dati,d=>d.passing)}, {a:"Dri",v:d3.mean(dati,d=>d.dribbling)}, {a:"Dif",v:d3.mean(dati,d=>d.defending)}, {a:"Fis",v:d3.mean(dati,d=>d.physic)}];
    const rS = d3.scaleLinear().range([0,r]).domain([0,100]), aS = (Math.PI*2)/m.length;

    [20,40,60,80,100].forEach(t => { 
        g.append("circle").attr("r",rS(t)).style("fill","none").style("stroke","#334155"); // Dark mode grid
        g.append("text").attr("y",-rS(t)-2).style("font-size","9px").style("fill","#64748b").text(t); 
    });
    
    const assi = g.selectAll(".asse").data(m.map(d=>d.a)).enter().append("g");
    assi.append("line").attr("x2",(d,i)=>rS(100)*Math.cos(aS*i-Math.PI/2)).attr("y2",(d,i)=>rS(100)*Math.sin(aS*i-Math.PI/2)).style("stroke","#475569");
    assi.append("text").attr("x",(d,i)=>(rS(100)+20)*Math.cos(aS*i-Math.PI/2)).attr("y",(d,i)=>(rS(100)+20)*Math.sin(aS*i-Math.PI/2)).style("text-anchor","middle").style("font-size","10px").style("fill","#94a3b8").text(d=>d); // Dark mode text
    
    g.append("path").datum(m).attr("d",d3.lineRadial().angle((d,i)=>i*aS).radius(d=>rS(d.v)).curve(d3.curveLinearClosed))
        .style("fill","#0ea5e9").style("fill-opacity",0.3).style("stroke","#38bdf8").style("stroke-width", 2); // Neon Ciano
}

function disegnaBarChart(dati) {
    const c = d3.select("#svg-bar"); c.html(""); if(!dati.length) return c.html("<div class='empty-state'>Nessun dato.</div>");
    const w = c.node().getBoundingClientRect().width, h = c.node().getBoundingClientRect().height, m = {t:30,r:20,b:40,l:40}, iW = w-m.l-m.r, iH = h-m.t-m.b;
    const g = c.append("svg").attr("width","100%").attr("height","100%").attr("viewBox",`0 0 ${w} ${h}`).append("g").attr("transform",`translate(${m.l},${m.t})`);
    
    const raggruppati = Array.from(d3.rollup(dati, v=>d3.mean(v, d=>d.potential), d=>d.age)).map(([age, potential])=>({age, potential})).sort((a,b)=>d3.ascending(a.age, b.age));
    const xS = d3.scaleBand().domain(raggruppati.map(d=>d.age)).range([0, iW]).padding(0.3), yS = d3.scaleLinear().domain([0, 100]).range([iH, 0]);

    const xA = g.append("g").attr("transform",`translate(0,${iH})`).call(d3.axisBottom(xS));
    xA.selectAll("path, line").attr("stroke", "#334155"); xA.selectAll("text").attr("fill", "#94a3b8");
    const yA = g.append("g").call(d3.axisLeft(yS).ticks(5));
    yA.selectAll("path, line").attr("stroke", "#334155"); yA.selectAll("text").attr("fill", "#94a3b8");

    g.selectAll(".bar").data(raggruppati).enter().append("rect").attr("x",d=>xS(d.age)).attr("y",d=>yS(d.potential)).attr("width",xS.bandwidth()).attr("height",d=>iH-yS(d.potential))
        .attr("fill","#38bdf8").attr("rx",3).attr("opacity",0.8); // Barre ciano scuro
    g.selectAll(".label").data(raggruppati).enter().append("text").attr("x",d=>xS(d.age)+xS.bandwidth()/2).attr("y",d=>yS(d.potential)-5).style("text-anchor","middle").style("font-size","9px").style("fill","#e2e8f0").text(d=>Math.round(d.potential));

    if(raggruppati.length>1) {
        let sX=0, sY=0, sXY=0, sXX=0, n=dati.length;
        dati.forEach(d => { sX+=d.age; sY+=d.potential; sXY+=d.age*d.potential; sXX+=d.age*d.age; });
        const mm = (n*sXY - sX*sY)/(n*sXX - sX*sX), qq = (sY - mm*sX)/n;
        const minA = d3.min(raggruppati, d=>d.age), maxA = d3.max(raggruppati, d=>d.age);
        g.append("line").attr("x1",xS(minA)+xS.bandwidth()/2).attr("y1",yS(mm*minA+qq)).attr("x2",xS(maxA)+xS.bandwidth()/2).attr("y2",yS(mm*maxA+qq))
            .attr("stroke","#ef4444").attr("stroke-width",3).attr("stroke-dasharray","5,5"); // Trend rosso neon
    }
}

function disegnaTabella(dati) {
    const c = d3.select("#table-wrapper"); c.html(""); if(!dati.length) return c.html("<div class='empty-state'>Nessun giocatore selezionato.</div>");
    const t = c.append("table").attr("class","sports-table"), th = t.append("thead").append("tr"), tb = t.append("tbody");
    
    ["Nome","Età","Nazionalità","Campionato","Ruolo","OVR","POT","Valore","Stipendio","Vel","Tir","Pas","Dri","Dif","Fis"].forEach(h=>th.append("th").text(h));
    
    tb.selectAll("tr").data(dati).enter().append("tr").selectAll("td")
      .data(d => [
          d.short_name, d.age, 
          d.nationality_name || "N/A", 
          d.league_name === "ALTRI CAMPIONATI" ? "ALTRI (" + d.original_league + ")" : d.league_name,
          d.player_positions, d.overall, d.potential, 
          (d.value_eur>=1e6?(d.value_eur/1e6).toFixed(1)+"M":(d.value_eur/1e3).toFixed(0)+"K"), 
          "€"+d.wage_eur, 
          d.pace, d.shooting, d.passing, d.dribbling, d.defending, d.physic
      ])
      .enter().append("td").text(d=>d);
}

// 7. GESTIONE BOTTONI MENU FLOTTANTE E LEGENDA
function inizializzaBottoniVista() {
    // 1. Modalità SCROLL (Spegne tutto)
    d3.select("#btn-scroll").on("click", function() {
        d3.selectAll(".fab-btn:not(.btn-danger)").classed("active", false); d3.select(this).classed("active", true);
        
        // Spegne lo zoom
        chartControls.pca.svg.on(".zoom", null);
        chartControls.eco.svg.on(".zoom", null);
        // Nasconde il Lazo
        chartControls.pca.brushGroup.style("display", "none");
        chartControls.eco.brushGroup.style("display", "none");
    });

    // 2. Modalità ZOOM (Naviga)
    d3.select("#btn-zoom").on("click", function() {
        d3.selectAll(".fab-btn:not(.btn-danger)").classed("active", false); d3.select(this).classed("active", true);
        
        // Attiva zoom, nasconde lazo
        chartControls.pca.svg.call(chartControls.pca.zoom); chartControls.pca.brushGroup.style("display", "none");
        chartControls.eco.svg.call(chartControls.eco.zoom); chartControls.eco.brushGroup.style("display", "none");
    });

    // 3. Modalità LAZO (Seleziona)
    d3.select("#btn-lasso").on("click", function() {
        d3.selectAll(".fab-btn:not(.btn-danger)").classed("active", false); d3.select(this).classed("active", true);
        
        // Spegne zoom, mostra lazo
        chartControls.pca.svg.on(".zoom", null); chartControls.pca.brushGroup.style("display", null);
        chartControls.eco.svg.on(".zoom", null); chartControls.eco.brushGroup.style("display", null);
    });
}
function disegnaLegenda() {
    const contenitore = d3.select("#league-legend");
    contenitore.html(""); 
    const campionati = colorScale.domain();
    
    const items = contenitore.selectAll(".legend-item")
        .data(campionati).enter().append("div").attr("class", "legend-item");
        
    items.append("span").attr("class", "legend-color").style("background-color", d => colorScale(d));
    items.append("span").text(d => d);
}

// --- 8. GESTIONE SIDEBAR A SCOMPARSA ---
function gestisciSidebar() {
    const sidebar = d3.select("#sidebar");
    const overlay = d3.select("#sidebar-overlay");

    function apriFiltri() {
        sidebar.classed("open", true);
        overlay.classed("active", true);
    }

    function chiudiFiltri() {
        sidebar.classed("open", false);
        overlay.classed("active", false);
    }

    d3.select("#btn-open-filters").on("click", apriFiltri);
    d3.select("#btn-close-filters").on("click", chiudiFiltri);
    overlay.on("click", chiudiFiltri);
    
    // Assicuriamoci che quando si clicca "Applica", la tendina si chiuda
    d3.select("#btn-apply-filters").on("click", function() {
        applicaFiltri(); // chiama la tua vecchia funzione
        chiudiFiltri();  // e poi chiude il menu
    });
}

// --- 9. MENU FLOTTANTE ESPANDIBILE E TRASCINABILE ---
function gestisciMenuFlottante() {
    const fabMenu = document.getElementById("floating-menu");
    const btnToggle = document.getElementById("btn-fab-toggle");
    
    let isDragging = false;
    let offsetX, offsetY;

    // Quando clicchiamo col mouse sul bottone principale
    btnToggle.addEventListener("mousedown", function(e) {
        isDragging = false; // Resettiamo lo stato
        
        // Calcoliamo dove abbiamo cliccato rispetto all'angolo del bottone
        const rect = fabMenu.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // Aggiungiamo i listener per seguire il movimento in tutta la pagina
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        
        // Previene la selezione del testo per errore mentre trasciniamo
        e.preventDefault();
    });

    function onMouseMove(e) {
        isDragging = true; // Se il mouse si muove, stiamo trascinando!
        
        // Spacchiamo i vincoli CSS "bottom" e "right" per usare solo "left" e "top"
        fabMenu.style.bottom = "auto";
        fabMenu.style.right = "auto";
        
        // Aggiorniamo la posizione in tempo reale
        fabMenu.style.left = (e.clientX - offsetX) + "px";
        fabMenu.style.top = (e.clientY - offsetY) + "px";
    }

    function onMouseUp(e) {
        // Togliamo gli "occhi" del browser dal mouse quando lo rilasciamo
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    }

    // Gestione dell'Apertura/Chiusura
    btnToggle.addEventListener("click", function() {
        // Apriamo il menu SOLO se non lo stavamo trascinando in giro
        if (!isDragging) {
            fabMenu.classList.toggle("open");
        }
    });
}