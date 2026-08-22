/* =========================================================
   RAKTSETU DISPATCHER DASHBOARD
   ========================================================= */


/*
    ---------------------------------------------------------
    TEMPORARY MOCK RECOMMENDATION DATA

    IMPORTANT:
    This is ONLY for Person-3 development.

    Later, we will replace this with Person-1's
    real recommendation API.
    ---------------------------------------------------------
*/


const recommendationData = {

    request_id: "R1001",

    hospital_id: "H01",

    hospital_name: "City Hospital",

    doctor_id: "D01",

    blood_type: "O-",

    units_needed: 3,

    urgency: "critical",

    hospital_lat: 28.6139,

    hospital_lng: 77.2090,

    verified: true,

    timestamp: "2026-08-22T10:00:00Z",

    status: "matched",

    allocations: [

        {
            bank_id: "B02",

            bank_name: "Bank B",

            bank_lat: 28.6200,

            bank_lng: 77.2100,

            units: 2,

            eta_min: 8,

            score: 0.91,

            reason:
                "High stock, near expiry, and very close to the hospital."
        },


        {
            bank_id: "B03",

            bank_name: "Bank C",

            bank_lat: 28.6250,

            bank_lng: 77.2150,

            units: 1,

            eta_min: 14,

            score: 0.78,

            reason:
                "Remaining compatible unit with expiry approaching in 2 days."
        }

    ]

};


/* =========================================================
   INITIALIZE DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadDashboard(
            recommendationData
        );

        setupMobileMenu();

    }
);


/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

function loadDashboard(data) {

    updateRequestInformation(data);

    renderAllocations(
        data.allocations
    );

    initializeMap(data);

}


/* =========================================================
   REQUEST INFORMATION
   ========================================================= */

function updateRequestInformation(data) {


    /* Request ID */

    const requestId =
        document.getElementById(
            "requestId"
        );

    if (requestId) {

        requestId.textContent =
            data.request_id;

    }


    /* Hospital */

    const hospitalName =
        document.getElementById(
            "hospitalName"
        );

    if (hospitalName) {

        hospitalName.textContent =
            data.hospital_name ||
            data.hospital_id;

    }


    /* Blood type */

    const unitsNeeded =
        document.getElementById(
            "unitsNeeded"
        );

    if (unitsNeeded) {

        unitsNeeded.textContent =
            data.units_needed;

    }


    /* Request status */

    const requestStatus =
        document.getElementById(
            "requestStatus"
        );

    if (requestStatus) {

        requestStatus.textContent =
            formatStatus(data.status);

    }


    /* Urgency */

    const urgencyBadge =
        document.getElementById(
            "urgencyBadge"
        );

    if (urgencyBadge) {

        const urgency =
            data.urgency.toLowerCase();

        urgencyBadge.textContent =
            urgency.toUpperCase();

        urgencyBadge.className =
            "urgency-badge " + urgency;

    }


    /* Details panel */

    const detailHospital =
        document.getElementById(
            "detailHospital"
        );

    if (detailHospital) {

        detailHospital.textContent =
            data.hospital_name ||
            data.hospital_id;

    }


    const detailBlood =
        document.getElementById(
            "detailBlood"
        );

    if (detailBlood) {

        detailBlood.textContent =
            getBloodTypeName(
                data.blood_type
            );

    }


    const doctorId =
        document.getElementById(
            "doctorId"
        );

    if (doctorId) {

        doctorId.textContent =
            data.doctor_id;

    }

}


/* =========================================================
   RENDER ALLOCATION CARDS
   ========================================================= */

function renderAllocations(
    allocations
) {

    const container =
        document.getElementById(
            "allocationContainer"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        !allocations ||
        allocations.length === 0
    ) {

        container.innerHTML = `

            <div class="allocation-card">

                <h3>No matching blood bank found</h3>

                <p>
                    Please review the request manually.
                </p>

            </div>

        `;

        return;
    }


    allocations.forEach(
        function (allocation, index) {

            const score =
                Math.round(
                    allocation.score * 100
                );


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "allocation-card" +
                (
                    index === 0
                        ? " best-match"
                        : ""
                );


            card.innerHTML = `

                ${
                    index === 0
                        ? `
                            <div class="best-label">
                                BEST MATCH
                            </div>
                          `
                        : ""
                }


                <div class="bank-header">

                    <div class="bank-info">

                        <div class="bank-icon">
                            🩸
                        </div>

                        <div>

                            <h3>
                                ${escapeHtml(
                                    allocation.bank_name
                                )}
                            </h3>

                            <span>
                                Blood Bank ID:
                                ${escapeHtml(
                                    allocation.bank_id
                                )}
                            </span>

                        </div>

                    </div>


                    <div class="score-container">

                        <span class="score-label">
                            MATCH SCORE
                        </span>

                        <span class="score">
                            ${score}%
                        </span>

                    </div>

                </div>


                <div class="allocation-details">


                    <div class="allocation-detail">

                        <span>
                            Units Allocated
                        </span>

                        <strong>
                            ${allocation.units}
                        </strong>

                    </div>


                    <div class="allocation-detail">

                        <span>
                            Estimated Arrival
                        </span>

                        <strong>
                            ${allocation.eta_min} min
                        </strong>

                    </div>


                    <div class="allocation-detail">

                        <span>
                            Compatibility
                        </span>

                        <strong>
                            ✓ Compatible
                        </strong>

                    </div>


                </div>


                <div class="reason-box">

                    <span class="reason-icon">
                        💡
                    </span>

                    <p>
                        <strong>
                            Why recommended:
                        </strong>

                        ${escapeHtml(
                            allocation.reason
                        )}
                    </p>

                </div>


                <button
                    class="dispatch-btn"
                    data-index="${index}"
                >

                    🚚 Confirm Dispatch

                </button>

            `;


            container.appendChild(card);

        }
    );


    attachDispatchEvents();

}


/* =========================================================
   DISPATCH BUTTONS
   ========================================================= */

function attachDispatchEvents() {

    const buttons =
        document.querySelectorAll(
            ".dispatch-btn"
        );


    buttons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const index =
                        Number(
                            button.dataset.index
                        );


                    confirmDispatch(
                        index,
                        button
                    );

                }
            );

        }
    );

}


/* =========================================================
   CONFIRM DISPATCH
   ========================================================= */

function confirmDispatch(
    index,
    button
) {

    const allocation =
        recommendationData
            .allocations[index];


    if (!allocation) {
        return;
    }


    const confirmed =
        window.confirm(

            `Confirm dispatch?\n\n` +

            `${allocation.units} unit(s)` +

            ` from ${allocation.bank_name}` +

            `\nEstimated arrival: ` +

            `${allocation.eta_min} minutes`

        );


    if (!confirmed) {
        return;
    }


    button.textContent =
        "✓ Dispatch Confirmed";


    button.classList.add(
        "confirmed"
    );


    button.disabled = true;


    showNotification(
        `Dispatch confirmed from ${allocation.bank_name}.`
    );


    updateDispatchCount();

}


/* =========================================================
   NOTIFICATION
   ========================================================= */

function showNotification(
    message
) {

    const notification =
        document.createElement(
            "div"
        );


    notification.style.position =
        "fixed";

    notification.style.right =
        "25px";

    notification.style.bottom =
        "25px";

    notification.style.background =
        "#111827";

    notification.style.color =
        "white";

    notification.style.padding =
        "14px 18px";

    notification.style.borderRadius =
        "10px";

    notification.style.fontSize =
        "12px";

    notification.style.fontWeight =
        "600";

    notification.style.boxShadow =
        "0 10px 30px rgba(0,0,0,0.2)";

    notification.style.zIndex =
        "9999";

    notification.innerHTML =
        "✓ " + escapeHtml(message);


    document.body.appendChild(
        notification
    );


    setTimeout(
        function () {

            notification.remove();

        },
        3000
    );

}


/* =========================================================
   UPDATE DISPATCH COUNT
   ========================================================= */

function updateDispatchCount() {

    const dispatchElement =
        document.getElementById(
            "activeDispatches"
        );


    if (!dispatchElement) {
        return;
    }


    const current =
        Number(
            dispatchElement.textContent
        );


    dispatchElement.textContent =
        current + 1;

}


/* =========================================================
   MAP
   ========================================================= */

function initializeMap(data) {

    const mapElement =
        document.getElementById(
            "map"
        );


    if (!mapElement) {
        return;
    }


    if (
        typeof L === "undefined"
    ) {

        console.error(
            "Leaflet was not loaded."
        );

        return;
    }


    const map =
        L.map("map");


    map.setView(
        [
            data.hospital_lat,
            data.hospital_lng
        ],
        13
    );


    /* OpenStreetMap */

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {

            attribution:
                "&copy; OpenStreetMap contributors"

        }
    ).addTo(map);


    /* Hospital marker */

    const hospitalIcon =
        L.divIcon({

            className:
                "custom-map-marker",

            html:
                `
                    <div style="
                        width:34px;
                        height:34px;
                        background:#dc2626;
                        border-radius:50% 50% 50% 0;
                        transform:rotate(-45deg);
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        box-shadow:0 4px 12px rgba(220,38,38,.35);
                    ">
                        <span style="
                            transform:rotate(45deg);
                            font-size:16px;
                        ">
                            🏥
                        </span>
                    </div>
                `,

            iconSize: [
                34,
                34
            ],

            iconAnchor: [
                17,
                34
            ]

        });


    L.marker(
        [
            data.hospital_lat,
            data.hospital_lng
        ],
        {
            icon: hospitalIcon
        }
    )
    .addTo(map)
    .bindPopup(

        `
            <strong>
                🏥 ${escapeHtml(
                    data.hospital_name
                )}
            </strong>

            <br><br>

            Blood Required:
            <strong>
                ${escapeHtml(
                    data.blood_type
                )}
            </strong>

            <br>

            Units:
            <strong>
                ${data.units_needed}
            </strong>
        `

    );


    /* Blood bank markers */

    data.allocations.forEach(
        function (bank) {

            if (
                bank.bank_lat === undefined ||
                bank.bank_lng === undefined
            ) {

                return;

            }


            const bankIcon =
                L.divIcon({

                    className:
                        "custom-map-marker",

                    html:
                        `
                            <div style="
                                width:30px;
                                height:30px;
                                background:#2563eb;
                                border-radius:50% 50% 50% 0;
                                transform:rotate(-45deg);
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                box-shadow:0 4px 12px rgba(37,99,235,.3);
                            ">
                                <span style="
                                    transform:rotate(45deg);
                                    font-size:14px;
                                ">
                                    🩸
                                </span>
                            </div>
                        `,

                    iconSize: [
                        30,
                        30
                    ],

                    iconAnchor: [
                        15,
                        30
                    ]

                });


            L.marker(
                [
                    bank.bank_lat,
                    bank.bank_lng
                ],
                {
                    icon: bankIcon
                }
            )
            .addTo(map)
            .bindPopup(

                `
                    <strong>
                        🩸 ${escapeHtml(
                            bank.bank_name
                        )}
                    </strong>

                    <br><br>

                    Allocated:
                    <strong>
                        ${bank.units} unit(s)
                    </strong>

                    <br>

                    ETA:
                    <strong>
                        ${bank.eta_min} minutes
                    </strong>

                    <br>

                    Match Score:
                    <strong>
                        ${Math.round(
                            bank.score * 100
                        )}%
                    </strong>
                `

            );

        }
    );

}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMobileMenu() {

    const button =
        document.getElementById(
            "mobileMenu"
        );


    const sidebar =
        document.getElementById(
            "sidebar"
        );


    if (
        !button ||
        !sidebar
    ) {

        return;

    }


    button.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );

        }
    );

}


/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

function formatStatus(
    status
) {

    if (!status) {
        return "-";
    }


    return status
        .replace(
            /_/g,
            " "
        )
        .toUpperCase();

}


function getBloodTypeName(
    type
) {

    const names = {

        "O-": "O Negative",
        "O+": "O Positive",

        "A-": "A Negative",
        "A+": "A Positive",

        "B-": "B Negative",
        "B+": "B Positive",

        "AB-": "AB Negative",
        "AB+": "AB Positive"

    };


    return names[type] || type;

}


/*
    Prevent HTML from being injected
    into dynamically generated content.
*/

function escapeHtml(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}