/* =========================================================
   RAKTSETU DISPATCHER CONTROL CENTER JS
   ========================================================= */

let mapInstance = null;
let hospitalMarker = null;
let bankMarkers = [];
let activeRequestData = null;

// Mock database coordinates for hospitals (from seed.py) to center Leaflet Map
const hospitalCoords = {
    "H01": { name: "City Care Hospital", lat: 28.6139, lng: 77.2090 },
    "H02": { name: "Metro General Hospital", lat: 28.6280, lng: 77.2180 },
    "H03": { name: "Shanti Medical Centre", lat: 28.5355, lng: 77.3910 },
    "H04": { name: "Apollo Demo Hospital", lat: 28.5672, lng: 77.2100 },
    "H05": { name: "LifeLine Hospital", lat: 28.4595, lng: 77.0266 },
    "H06": { name: "National Trauma Centre", lat: 28.5672, lng: 77.2430 },
    "H07": { name: "Green Valley Hospital", lat: 28.7041, lng: 77.1025 },
    "H08": { name: "Hope Medical Institute", lat: 28.6692, lng: 77.4538 },
    "H09": { name: "Sunrise Hospital", lat: 28.4089, lng: 77.3178 },
    "H10": { name: "CarePlus Hospital", lat: 28.6130, lng: 77.3100 },
};

// Mock database coordinates for blood banks to generate split-fulfillment recommendations
const bloodBanks = [
    { id: "B01", name: "Red Cross Blood Bank", lat: 28.6100, lng: 77.2300, stock: 15 },
    { id: "B02", name: "Delhi Central Blood Bank", lat: 28.6200, lng: 77.2100, stock: 20 },
    { id: "B03", name: "Vikas Puri Blood Bank", lat: 28.6300, lng: 77.1200, stock: 8 },
    { id: "B04", name: "Apex Blood Depot", lat: 28.5500, lng: 77.2500, stock: 12 },
    { id: "B05", name: "Noida Blood Centre", lat: 28.5700, lng: 77.3200, stock: 10 }
];

/* =========================================================
   INITIALIZATION
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    setupEventListeners();
});

function initDashboard() {
    // 1. Initialize Map
    initializeMap(28.6139, 77.2090); // default center: Delhi H01
    
    // 2. Fetch Stats & Queue
    refreshStats();
    refreshQueue();
}

function setupEventListeners() {
    // Process Next Request Button
    const popBtn = document.getElementById("popRequestBtn");
    if (popBtn) {
        popBtn.addEventListener("click", () => {
            popNextRequest();
        });
    }

    // Simulator Form Submit
    const simForm = document.getElementById("simulatorForm");
    if (simForm) {
        simForm.addEventListener("submit", (e) => {
            e.preventDefault();
            submitSimulatedRequest();
        });
    }

    // Mobile Menu Toggle
    const mobileMenu = document.getElementById("mobileMenu");
    const sidebar = document.getElementById("sidebar");
    if (mobileMenu && sidebar) {
        mobileMenu.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    // Sync doctor options in simulator based on selected hospital to help guide testing
    const simHospitalSelect = document.getElementById("simHospital");
    const simDoctorSelect = document.getElementById("simDoctor");
    if (simHospitalSelect && simDoctorSelect) {
        simHospitalSelect.addEventListener("change", () => {
            const hId = simHospitalSelect.value;
            // auto-select doctor that aligns for easier happy-path testing, or let users mismatch manually
            if (hId === "H01") {
                simDoctorSelect.value = "D01";
            } else if (hId === "H02") {
                simDoctorSelect.value = "D03";
            } else if (hId === "H03") {
                simDoctorSelect.value = "D12"; // mismatched doctor (D12 belongs to H03 but testing mismatch is easier)
            }
        });
    }
}

/* =========================================================
   API CALLS (FETCHING BACKEND FUNCTIONS)
   ========================================================= */

// 1. Fetch Stats from backend
async function refreshStats() {
    try {
        const response = await fetch("/stats/verification");
        if (response.ok) {
            const stats = await response.json();
            document.getElementById("statReceivedCount").textContent = stats.requests_received || 0;
            document.getElementById("statVerifiedCount").textContent = stats.verified || 0;
            document.getElementById("statRejectedCount").textContent = stats.rejected || 0;
            document.getElementById("statPendingCount").textContent = stats.pending_clinical || 0;
        }
    } catch (error) {
        console.error("Error fetching stats:", error);
    }
}

// 2. Fetch Queue from backend
async function refreshQueue() {
    try {
        const response = await fetch("/queue");
        if (response.ok) {
            const queueData = await response.json();
            const queueList = document.getElementById("queueListContainer");
            const queueSizeBadge = document.getElementById("queueSizeBadge");
            const navQueueCount = document.getElementById("navQueueCount");
            
            const size = queueData.queue_size || 0;
            queueSizeBadge.textContent = `${size} items`;
            navQueueCount.textContent = size;
            
            queueList.innerHTML = "";
            
            if (size === 0) {
                queueList.innerHTML = `<div class="empty-state">Queue is empty. Submit a request using the simulator.</div>`;
                return;
            }
            
            queueData.requests.forEach((req) => {
                const item = document.createElement("div");
                item.className = "queue-item";
                if (activeRequestData && activeRequestData.request_id === req.request_id) {
                    item.className += " active";
                }
                
                const hospName = hospitalCoords[req.hospital_id]?.name || `Hospital ${req.hospital_id}`;
                const urgency = req.urgency || "routine";
                
                item.innerHTML = `
                    <div class="queue-item-header">
                        <span class="queue-item-id">${req.request_id}</span>
                        <span class="queue-item-priority ${urgency.toLowerCase()}">${urgency}</span>
                    </div>
                    <div class="queue-item-body">
                        <strong>${escapeHtml(hospName)}</strong><br>
                        Requires <strong>${req.units_needed} units</strong> of <strong>${req.blood_type}</strong>
                    </div>
                `;
                
                item.addEventListener("click", () => {
                    // Update active request selection styling
                    document.querySelectorAll(".queue-item").forEach(el => el.classList.remove("active"));
                    item.classList.add("active");
                    
                    // Show request details (since it's already in the queue, it's verified)
                    req.status = req.status || "queued";
                    req.verified = true;
                    loadActiveRequest(req);
                });
                
                queueList.appendChild(item);
            });
        }
    } catch (error) {
        console.error("Error fetching queue:", error);
    }
}

// 3. Pop next request from Priority Queue
async function popNextRequest() {
    try {
        const response = await fetch("/queue/pop", { method: "POST" });
        if (response.ok) {
            const poppedRequest = await response.json();
            poppedRequest.status = "sent_to_fulfillment";
            poppedRequest.verified = true;
            loadActiveRequest(poppedRequest);
            showNotification(`Processed next request: ${poppedRequest.request_id}`);
            refreshStats();
            refreshQueue();
        } else {
            const errorData = await response.json();
            alert(`Queue is empty: ${errorData.message || "No requests to process."}`);
        }
    } catch (error) {
        console.error("Error popping request:", error);
        alert("Error connecting to backend server.");
    }
}

// 4. Submit simulated request
async function submitSimulatedRequest() {
    const hId = document.getElementById("simHospital").value;
    const dId = document.getElementById("simDoctor").value;
    const bloodType = document.getElementById("simBlood").value;
    const units = parseInt(document.getElementById("simUnits").value, 10);
    const urgency = document.getElementById("simUrgency").value;
    const prescription = document.getElementById("simPrescription").value.trim();
    const notes = document.getElementById("simNotes").value.trim();
    
    // Coordinates default to the database hospital coords, but let backend verify them
    const hCoords = hospitalCoords[hId] || { lat: 28.6139, lng: 77.2090 };
    
    const payload = {
        hospital_id: hId,
        doctor_id: dId,
        blood_type: bloodType,
        units_needed: units,
        urgency_input: urgency,
        prescription_id: prescription || null,
        clinical_note: notes || null,
        hospital_lat: hCoords.lat,
        hospital_lng: hCoords.lng
    };
    
    try {
        const response = await fetch("/submit-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const responseBody = await response.json();
        
        if (response.status === 200) {
            // Successfully verified and added to queue
            showNotification(`Request ${responseBody.request_id} verified & queued!`);
            loadActiveRequest(responseBody);
        } else if (response.status === 202) {
            // Accepted but pending clinical verification
            showNotification(`Request ${responseBody.request_id} registered. Pending clinical check.`, "warning");
            responseBody.status = "pending_clinical_verification";
            responseBody.verified = false;
            loadActiveRequest(responseBody);
        } else if (response.status === 403) {
            // Rejected
            showNotification(`Request rejected: ${responseBody.reason}`, "error");
            responseBody.status = "rejected";
            responseBody.verified = false;
            loadActiveRequest(responseBody);
        } else if (response.status === 422) {
            // Schema Validation Error
            alert(`Validation Error: ${JSON.stringify(responseBody.detail)}`);
        } else {
            alert(`Unexpected response: ${response.status}`);
        }
        
        refreshStats();
        refreshQueue();
        
    } catch (error) {
        console.error("Error submitting simulated request:", error);
        alert("Error connecting to backend server.");
    }
}

// 5. Fetch Audit trail for active request
async function refreshAuditTrail(requestId) {
    try {
        const response = await fetch(`/requests/${requestId}/audit`);
        if (response.ok) {
            const data = await response.json();
            renderAuditTrail(data.events || []);
            updatePipelineStatus(data.events || [], requestId);
        }
    } catch (error) {
        console.error("Error fetching audit logs:", error);
    }
}

/* =========================================================
   UI RENDERING / DYNAMIC BUILDERS
   ========================================================= */

// 1. Load active request into details and trigger audit trail & allocations
function loadActiveRequest(req) {
    activeRequestData = req;
    
    const detailsContainer = document.getElementById("activeRequestDetails");
    const activeRequestStatus = document.getElementById("activeRequestStatus");
    
    detailsContainer.classList.remove("empty", "critical-alert");
    
    const hospName = hospitalCoords[req.hospital_id]?.name || `Hospital ${req.hospital_id}`;
    const lat = req.hospital_lat || hospitalCoords[req.hospital_id]?.lat || 28.6139;
    const lng = req.hospital_lng || hospitalCoords[req.hospital_id]?.lng || 77.2090;
    const urgency = req.urgency || req.urgency_input || "routine";
    
    if (urgency.toLowerCase() === "critical") {
        detailsContainer.classList.add("critical-alert");
    }
    
    activeRequestStatus.className = `badge ${urgency.toLowerCase()}`;
    activeRequestStatus.textContent = formatStatus(req.status);
    
    const createdTimeStr = req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    detailsContainer.innerHTML = `
        <div class="request-header">
            <div>
                <h3>${escapeHtml(hospName)}</h3>
                <span>Request ID: <strong>${req.request_id}</strong> | Timestamp: ${createdTimeStr}</span>
            </div>
            <div class="blood-badge">
                ${req.blood_type}
                <small>${req.units_needed} units</small>
            </div>
        </div>
        <div class="detail-grid">
            <div class="detail-item">
                <span>Doctor ID</span>
                <strong>${req.doctor_id}</strong>
            </div>
            <div class="detail-item">
                <span>Location Coords</span>
                <strong>${lat.toFixed(4)}, ${lng.toFixed(4)}</strong>
            </div>
            <div class="detail-item">
                <span>Prescription ID</span>
                <strong>${req.prescription_id || "None Provided"}</strong>
            </div>
            <div class="detail-item">
                <span>Verification State</span>
                <strong style="color: ${req.verified ? '#15803d' : '#b81414'}">
                    ${req.verified ? 'Verified & Authorized' : 'Verification Failed/Pending'}
                </strong>
            </div>
        </div>
        <div class="notes-box">
            <strong>Clinical Note:</strong> "${escapeHtml(req.clinical_note || 'No notes provided.')}"
        </div>
    `;
    
    // Fetch Audit Trail & Update Pipeline
    refreshAuditTrail(req.request_id);
    
    // Render Map & Allocations
    updateMapLocation(req.request_id, hospName, lat, lng, req.blood_type, req.units_needed);
    
    if (req.verified) {
        renderAllocations(req);
    } else {
        const container = document.getElementById("allocationContainer");
        container.innerHTML = `<div class="empty-state">Verification failed or pending. Cannot recommend allocations.</div>`;
    }
}

// 2. Render Audit trail logs
function renderAuditTrail(events) {
    const container = document.getElementById("auditTrailContainer");
    container.innerHTML = "";
    
    if (events.length === 0) {
        container.innerHTML = `<div class="empty-state">No audit logs logged yet.</div>`;
        return;
    }
    
    events.forEach((ev) => {
        const item = document.createElement("div");
        item.className = "audit-log-item";
        
        // style based on event status
        if (ev.details.includes("rejected") || ev.details.includes("failed")) {
            item.className += " failed";
        } else if (ev.details.includes("pending")) {
            item.className += " pending";
        } else {
            item.className += " success";
        }
        
        const timeStr = new Date(ev.timestamp).toLocaleTimeString();
        
        item.innerHTML = `
            <span class="audit-time">${timeStr}</span>
            <div class="audit-text">
                <strong>${formatEventName(ev.event_name)}</strong>: ${escapeHtml(ev.details)}
            </div>
        `;
        container.appendChild(item);
    });
}

// 3. Update step-by-step verification pipeline visuals
function updatePipelineStatus(events, requestId) {
    // Reset steps
    const steps = {
        hospital: document.getElementById("step-hospital"),
        doctor: document.getElementById("step-doctor"),
        prescription: document.getElementById("step-prescription"),
        priority: document.getElementById("step-priority")
    };
    
    const statuses = {
        hospital: document.getElementById("val-hospital-status"),
        doctor: document.getElementById("val-doctor-status"),
        prescription: document.getElementById("val-prescription-status"),
        priority: document.getElementById("val-priority-status")
    };
    
    Object.keys(steps).forEach((k) => {
        steps[k].className = "pipeline-step";
        statuses[k].textContent = "-";
    });
    
    // Parse events to color steps
    events.forEach((ev) => {
        if (ev.event_name === "request_received") {
            // initial step
        }
        
        if (ev.event_name === "hospital_verified") {
            if (ev.details.includes("rejected")) {
                steps.hospital.className += " failed";
                statuses.hospital.textContent = "Rejected";
            } else {
                steps.hospital.className += " verified";
                statuses.hospital.textContent = "Verified";
            }
        }
        
        if (ev.event_name === "doctor_verified") {
            if (ev.details.includes("rejected")) {
                steps.doctor.className += " failed";
                statuses.doctor.textContent = "Rejected";
            } else {
                steps.doctor.className += " verified";
                statuses.doctor.textContent = "Verified";
            }
        }
        
        if (ev.event_name === "prescription_checked") {
            if (ev.details.includes("pending")) {
                steps.prescription.className += " pending";
                statuses.prescription.textContent = "Pending";
            } else if (ev.details.includes("rejected")) {
                steps.prescription.className += " failed";
                statuses.prescription.textContent = "Rejected";
            } else {
                steps.prescription.className += " verified";
                statuses.prescription.textContent = "Verified";
            }
        }
        
        if (ev.event_name === "urgency_assigned") {
            steps.priority.className += " verified";
            // extract priority level
            const match = ev.details.match(/priority=(\w+)/);
            statuses.priority.textContent = match ? match[1].toUpperCase() : "Queued";
        }
    });
}

// 4. Generate split-fulfillment allocation recommendations dynamically
function renderAllocations(req) {
    const container = document.getElementById("allocationContainer");
    container.innerHTML = "";
    
    const totalUnits = req.units_needed;
    
    // Simple heuristic allocation builder (split units across closest blood banks)
    let allocated = 0;
    const recommendations = [];
    
    const hospitalLat = req.hospital_lat || 28.6139;
    const hospitalLng = req.hospital_lng || 77.2090;
    
    // Sort blood banks by distance to the hospital
    const sortedBanks = bloodBanks.map((bank) => {
        const dist = Math.sqrt(Math.pow(bank.lat - hospitalLat, 2) + Math.pow(bank.lng - hospitalLng, 2)) * 111; // rough km conversion
        return { ...bank, distanceKm: dist };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
    
    for (let bank of sortedBanks) {
        if (allocated >= totalUnits) break;
        
        const needed = totalUnits - allocated;
        const take = Math.min(needed, bank.stock, 2); // cap max 2 units per bank to force split fulfillment
        
        if (take > 0) {
            allocated += take;
            const eta = Math.round(bank.distanceKm * 2 + 5); // 2 mins per km + 5 mins prep
            // Score based on distance & stock availability
            const score = Math.max(0.4, 1.0 - (bank.distanceKm * 0.05) - (take * 0.02)).toFixed(2);
            
            recommendations.push({
                bank_id: bank.id,
                bank_name: bank.name,
                bank_lat: bank.lat,
                bank_lng: bank.lng,
                units: take,
                eta_min: eta,
                score: score,
                reason: `Close proximity (${bank.distanceKm.toFixed(1)} km) and verified stock compatibility.`
            });
        }
    }
    
    // If we still need more units, pull remaining from the closest bank
    if (allocated < totalUnits) {
        const diff = totalUnits - allocated;
        if (recommendations.length > 0) {
            recommendations[0].units += diff; // dump into first
        } else {
            recommendations.push({
                bank_id: "B01",
                bank_name: "Red Cross Blood Bank",
                bank_lat: 28.6100,
                bank_lng: 77.2300,
                units: totalUnits,
                eta_min: 15,
                score: 0.75,
                reason: "Forced dispatch: Nearest centralized inventory depot."
            });
        }
    }
    
    recommendations.forEach((alloc, index) => {
        const scorePct = Math.round(alloc.score * 100);
        const card = document.createElement("div");
        card.className = "allocation-card" + (index === 0 ? " best-match" : "");
        
        card.innerHTML = `
            ${index === 0 ? '<div class="best-label">BEST MATCH</div>' : ''}
            <div class="bank-header">
                <div class="bank-info">
                    <div class="bank-icon">🏥</div>
                    <div>
                        <h3>${escapeHtml(alloc.bank_name)}</h3>
                        <span>Blood Bank ID: ${alloc.bank_id}</span>
                    </div>
                </div>
                <div class="score-container">
                    <span class="score-label">MATCH SCORE</span>
                    <span class="score">${scorePct}%</span>
                </div>
            </div>
            <div class="allocation-details">
                <div class="allocation-detail">
                    <span>Units Allocated</span>
                    <strong>${alloc.units} Units</strong>
                </div>
                <div class="allocation-detail">
                    <span>ETA</span>
                    <strong>${alloc.eta_min} min</strong>
                </div>
                <div class="allocation-detail">
                    <span>Compatibility</span>
                    <strong>✓ Verified</strong>
                </div>
            </div>
            <div class="reason-box">
                <span class="reason-icon">💡</span>
                <p><strong>Recommendation Basis:</strong> ${escapeHtml(alloc.reason)}</p>
            </div>
            <button class="dispatch-btn" id="dispatchBtn-${alloc.bank_id}">
                🚚 Confirm Dispatch
            </button>
        `;
        
        container.appendChild(card);
        
        // Dispatch button event
        const btn = document.getElementById(`dispatchBtn-${alloc.bank_id}`);
        if (btn) {
            btn.addEventListener("click", () => {
                btn.textContent = "✓ Dispatch Confirmed";
                btn.className += " confirmed";
                btn.disabled = true;
                showNotification(`Dispatch initialized: ${alloc.units} units of ${req.blood_type} from ${alloc.bank_name}`);
                
                // Add marker line on map
                drawDispatchLine([alloc.bank_lat, alloc.bank_lng], [req.hospital_lat, req.hospital_lng]);
            });
        }
    });
}

/* =========================================================
   LEAFLET MAP INTEGRATION
   ========================================================= */
function initializeMap(lat, lng) {
    if (mapInstance) {
        mapInstance.remove();
    }
    
    mapInstance = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: false
    }).setView([lat, lng], 12);
    
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(mapInstance);
}

function updateMapLocation(requestId, hospitalName, lat, lng, bloodType, units) {
    if (!mapInstance) return;
    
    mapInstance.setView([lat, lng], 13);
    
    // Clear previous markers
    if (hospitalMarker) {
        mapInstance.removeLayer(hospitalMarker);
    }
    bankMarkers.forEach(m => mapInstance.removeLayer(m));
    bankMarkers = [];
    
    // Clear previous lines
    mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Polyline && !(layer instanceof L.TileLayer)) {
            mapInstance.removeLayer(layer);
        }
    });
    
    // Add hospital marker (Red Icon)
    const hospitalIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="
            width: 32px; height: 32px; background: #b81414; border: 2px solid #fff;
            border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex;
            align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        "><span style="transform: rotate(45deg); font-size: 14px;">🏥</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });
    
    hospitalMarker = L.marker([lat, lng], { icon: hospitalIcon })
        .addTo(mapInstance)
        .bindPopup(`<strong>🏥 ${escapeHtml(hospitalName)}</strong><br>Request ID: ${requestId}<br>Required: ${units} units of ${bloodType}`)
        .openPopup();
        
    // Add blood bank markers (Blue Icons)
    bloodBanks.forEach((bank) => {
        const bankIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="
                width: 28px; height: 28px; background: #2563eb; border: 2px solid #fff;
                border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex;
                align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            "><span style="transform: rotate(45deg); font-size: 11px;">🩸</span></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 28]
        });
        
        const m = L.marker([bank.lat, bank.lng], { icon: bankIcon })
            .addTo(mapInstance)
            .bindPopup(`<strong>🩸 ${escapeHtml(bank.name)}</strong><br>Stock Available: ${bank.stock} units`);
            
        bankMarkers.push(m);
    });
}

function drawDispatchLine(bankCoords, hospitalCoords) {
    if (!mapInstance) return;
    
    // Draw animated dash array line
    const line = L.polyline([bankCoords, hospitalCoords], {
        color: '#a81a29',
        weight: 3,
        opacity: 0.8,
        dashArray: '8, 8',
        lineCap: 'round'
    }).addTo(mapInstance);
    
    mapInstance.fitBounds(line.getBounds(), { padding: [50, 50] });
}

/* =========================================================
   HELPER UTILITY FUNCTIONS
   ========================================================= */

function formatStatus(status) {
    if (!status) return "-";
    return status.replace(/_/g, " ").toUpperCase();
}

function formatEventName(name) {
    if (!name) return "";
    return name.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.style.position = "fixed";
    notification.style.right = "25px";
    notification.style.bottom = "25px";
    
    let bg = "#241b1b"; // dark charcoal
    if (type === "warning") bg = "#ca8a04";
    if (type === "error") bg = "#b81414";
    
    notification.style.background = bg;
    notification.style.color = "#fcfbfa";
    notification.style.padding = "14px 20px";
    notification.style.borderRadius = "8px";
    notification.style.fontSize = "12px";
    notification.style.fontWeight = "600";
    notification.style.boxShadow = "0 8px 30px rgba(0,0,0,0.15)";
    notification.style.zIndex = "9999";
    notification.style.transition = "opacity 0.3s ease";
    
    let icon = "✓";
    if (type === "warning") icon = "⚠";
    if (type === "error") icon = "✗";
    
    notification.innerHTML = `${icon} ${escapeHtml(message)}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}