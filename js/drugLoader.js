// Loads drug data from JSON asynchronously
async function loadDrugData() {
    try {
        const response = await fetch("data/drugs.json");
        const drugs = await response.json();
        return drugs;
    } catch (error) {
        console.error("Error loading drug data:", error);
        return {};
    }
}

// Populates drug selection dropdown
async function populateDrugDropdown() {
    const drugs = await loadDrugData();
    const drugSelect = document.getElementById("drugSelect");

    if (!drugSelect) return;

    Object.keys(drugs).forEach(key => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = drugs[key].name;
        drugSelect.appendChild(option);
    });
}

// Loads vial options when a drug is selected
async function loadVialOptions(drugKey) {
    const drugs = await loadDrugData();
    const drug = drugs[drugKey];
    const vialSelect = document.getElementById("vialSelect");

    vialSelect.innerHTML = ""; // clear old options

    drug.availableVials.forEach((vial, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = vial.strength;
        vialSelect.appendChild(option);
    });

    vialSelect.selectedIndex = drug.defaultVialIndex;
}
