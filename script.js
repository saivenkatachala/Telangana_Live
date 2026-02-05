const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSg7I76jd8Qx5hBdnMvQ4giwsbTaVfqvuYb_Igtt1L_pt1QHYt5cNMezVMr5pLGiXFbhXOr9i--oK6v/pub?output=csv";
const utmProj = "+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs";
const wgs84Proj = "EPSG:4326";

const map = L.map('map').setView([17.8, 79.1], 7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

let geojsonLayer, csvData = [], telanganaGeoJSON, currentField = "none";

// Initialize Draggable Table
$(function() { $("#floating-table-container").draggable({ handle: "#table-header" }); });

fetch('TS_DISTRICTS_UTM.geojson').then(res => res.json()).then(data => {
    data.features.forEach(f => {
        f.geometry.coordinates = f.geometry.type === "Polygon" 
            ? f.geometry.coordinates.map(r => r.map(c => proj4(utmProj, wgs84Proj, c)))
            : f.geometry.coordinates.map(p => p.map(r => r.map(c => proj4(utmProj, wgs84Proj, c))));
    });
    telanganaGeoJSON = data;
    populateDropdown(data);
    fetchLiveData();
});

function fetchLiveData() {
    Papa.parse(SHEET_CSV_URL, {
        download: true, header: true, skipEmptyLines: true,
        complete: function(results) {
            csvData = results.data;
            document.getElementById('last-update').innerText = "Last sync: " + new Date().toLocaleTimeString();
            renderMap(telanganaGeoJSON);
            updateTable(); 
        }
    });
}

function updateTable() {
    const tbody = document.querySelector("#districtTable tbody");
    tbody.innerHTML = "";
    // Show ALL data in table regardless of filter
    csvData.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${row.District}</td><td>${row.Temperature}</td><td>${row.Population}</td><td>${row.Births}</td><td>${row.Deaths}</td>`;
        tr.onclick = () => highlightDistrict(row.District);
        tbody.appendChild(tr);
    });
}

function highlightDistrict(name) {
    geojsonLayer.eachLayer(layer => {
        if (layer.feature.properties.District.toLowerCase() === name.toLowerCase()) {
            layer.setStyle({ fillColor: '#e74c3c', fillOpacity: 0.9 });
            const data = csvData.find(r => r.District.trim().toLowerCase() === name.toLowerCase());
            // Show all data fields in popup
            const content = `<b>${name}</b><hr>🌡️ Temp: ${data.Temperature}<br>👥 Pop: ${data.Population}<br>👶 Births: ${data.Births}<br>⚰️ Deaths: ${data.Deaths}`;
            layer.bindPopup(content).openPopup();
            // Highlight only, no zooming as requested
        } else {
            geojsonLayer.resetStyle(layer);
        }
    });
}

function renderMap(geoData) {
    if (geojsonLayer) map.removeLayer(geojsonLayer);
    geojsonLayer = L.geoJSON(geoData, {
        style: { fillColor: '#3498db', weight: 1.5, color: 'white', fillOpacity: 0.6 },
        onEachFeature: function(feature, layer) {
            const districtName = feature.properties.District;
            const data = csvData.find(row => row.District.trim().toLowerCase() === districtName.toLowerCase());
            
            layer.on('mouseover', function(e) {
                let text = districtName;
                if (currentField !== "none" && data) {
                    text = `${districtName}, ${currentField}: ${data[currentField]}`;
                }
                layer.bindTooltip(text, { sticky: true }).openTooltip();
                this.setStyle({ fillOpacity: 0.8, fillColor: '#2ecc71' });
            });
            layer.on('mouseout', function(e) { geojsonLayer.resetStyle(this); });
        }
    }).addTo(map);
}

// RESTORED ZOOM-OUT LOGIC
document.getElementById('districtSelect').onchange = function() {
    const selected = Array.from(this.selectedOptions).map(o => o.value);
    if (selected.includes('all')) {
        renderMap(telanganaGeoJSON);
        map.setView([17.8, 79.1], 7); // Zoom out to full state
    } else {
        const filtered = {
            ...telanganaGeoJSON, features: telanganaGeoJSON.features.filter(f => selected.includes(f.properties.District))
        };
        renderMap(filtered);
        map.fitBounds(geojsonLayer.getBounds(), { padding: [40, 40] }); // Focus on selection
    }
};

document.getElementById('fieldSelect').onchange = function() { currentField = this.value; renderMap(telanganaGeoJSON); };
document.getElementById('viewTableBtn').onclick = () => $("#floating-table-container").fadeIn();
document.getElementById('closeTableBtn').onclick = () => $("#floating-table-container").fadeOut();
document.getElementById('refreshBtn').onclick = fetchLiveData;

function populateDropdown(data) {
    const select = document.getElementById('districtSelect');
    data.features.map(f => f.properties.District).sort().forEach(n => {
        const opt = document.createElement('option'); opt.value = n; opt.text = n; select.appendChild(opt);
    });
}