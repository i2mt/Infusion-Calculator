let drugs = {};

fetch("drugs.json")
  .then(res => res.json())
  .then(data => {
    drugs = data;
    initDrugSelect();
  });

function initDrugSelect() {
  const drugSelect = document.getElementById("drugSelect");

  for (let key in drugs) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = drugs[key].name;
    drugSelect.appendChild(option);
  }

  drugSelect.addEventListener("change", updateDrugUI);
  updateDrugUI();
}

function updateDrugUI() {
  const selectedDrug = drugs[document.getElementById("drugSelect").value];

  document.getElementById("doseUnit").textContent = selectedDrug.dose_unit;
  document.getElementById("doseInput").value = selectedDrug.default_dose;

  const concentrationSelect = document.getElementById("concentrationSelect");
  concentrationSelect.innerHTML = "";

  selectedDrug.standard_concentrations.forEach((c, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = c.label;
    concentrationSelect.appendChild(option);
  });
}

function calculate() {
  const drugKey = document.getElementById("drugSelect").value;
  const d = drugs[drugKey];

  const weight = parseFloat(document.getElementById("weightInput").value);
  const dose = parseFloat(document.getElementById("doseInput").value);
  const concentrationObj =
    d.standard_concentrations[document.getElementById("concentrationSelect").value];

  let concentration =
    concentrationObj.mcg_per_ml ||
    concentrationObj.mg_per_ml ||
    concentrationObj.units_per_ml;

  let rateMlHr = 0;

  if (d.dose_unit.includes("mcg/kg/min")) {
    rateMlHr = (dose * weight * 60) / concentration;
  } else if (d.dose_unit.includes("mg/min")) {
    rateMlHr = (dose * 60) / concentration;
  } else if (d.dose_unit.includes("units/hr")) {
    rateMlHr = dose / concentration;
  } else if (d.dose_unit.includes("mg/hr")) {
    rateMlHr = dose / concentration;
  }

  document.getElementById("result").innerHTML = `
    <h2>Rate: ${rateMlHr.toFixed(2)} mL/hr</h2>
  `;
}
