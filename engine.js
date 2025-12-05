// engine.js
// Simple client-side infusion engine. Drop into your project and include <script src="engine.js"></script>
// Assumes drugs_v2.json is placed at the same path. No external libs required.

// ---------- state ----------
const InfusionEngine = {
  drugs: {},
  loaded: false,
  lastError: null,
  loadPromise: null
};

// ---------- load DB ----------
InfusionEngine.load = function(path = "drugs_v2.json") {
  if (this.loadPromise) return this.loadPromise;
  this.loadPromise = fetch(path)
    .then(r => {
      if (!r.ok) throw new Error("Failed to load drugs DB: " + r.status);
      return r.json();
    })
    .then(data => {
      this.drugs = data;
      this.loaded = true;
      return data;
    })
    .catch(err => {
      console.error(err);
      this.lastError = err;
      throw err;
    });
  return this.loadPromise;
};

// ---------- helpers: unit conversions ----------
const toNumber = (v) => (v === null || v === undefined || v === "") ? NaN : Number(v);

// Normalize: return an object describing concentration in base units:
// For vasoactives we will use mcg/ml as base if vials in mg, convert to mcg...
InfusionEngine.computeFinalConcentration = function(chosenVial, dilutionMl, doseTypeHint) {
  // chosenVial: object from drug.vials
  // dilutionMl: numeric
  // doseTypeHint: used to choose unit base (mcg vs mg vs units)
  dilutionMl = Number(dilutionMl);
  if (isNaN(dilutionMl) || dilutionMl <= 0) return null;

  // Determine base
  if (chosenVial.strength_mg) {
    // return both mg/ml and mcg/ml
    const mg_per_ml = (chosenVial.strength_mg) / dilutionMl;
    const mcg_per_ml = mg_per_ml * 1000;
    return { mg_per_ml, mcg_per_ml, units_per_ml: null, base: "mg/mcg" };
  }
  if (chosenVial.strength_units) {
    const units_per_ml = (chosenVial.strength_units) / dilutionMl;
    return { mg_per_ml: null, mcg_per_ml: null, units_per_ml, base: "units" };
  }
  // fallback if vial already gives mcg_per_ml key
  if (chosenVial.mcg_per_ml) {
    return { mg_per_ml: chosenVial.mcg_per_ml / 1000, mcg_per_ml: chosenVial.mcg_per_ml, units_per_ml: null, base: "mcg" };
  }
  return null;
};

// ---------- conversions: dose -> mL/hr ----------
InfusionEngine.convertDoseToMlPerHr = function({doseInput, doseType, drug, weightKg, finalConc}) {
  // finalConc: output of computeFinalConcentration
  doseInput = Number(doseInput);
  weightKg = Number(weightKg);
  if (isNaN(doseInput)) throw new Error("doseInput must be a number");
  // finalConc must contain mcg_per_ml or mg_per_ml or units_per_ml depending on doseType.
  // Return mL/hr (number)
  if (doseType === "mcg/kg/min") {
    if (!finalConc || finalConc.mcg_per_ml == null) throw new Error("finalConc missing mcg_per_ml");
    const mcg_per_min = doseInput * weightKg;
    const mcg_per_hr = mcg_per_min * 60;
    return mcg_per_hr / finalConc.mcg_per_ml;
  }

  if (doseType === "mcg/min") {
    if (!finalConc || finalConc.mcg_per_ml == null) throw new Error("finalConc missing mcg_per_ml");
    const mcg_per_hr = doseInput * 60;
    return mcg_per_hr / finalConc.mcg_per_ml;
  }

  if (doseType === "mg/min") {
    if (!finalConc || finalConc.mg_per_ml == null) throw new Error("finalConc missing mg_per_ml");
    const mg_per_hr = doseInput * 60;
    return mg_per_hr / finalConc.mg_per_ml;
  }

  if (doseType === "mg/hr") {
    if (!finalConc || finalConc.mg_per_ml == null) throw new Error("finalConc missing mg_per_ml");
    return doseInput / finalConc.mg_per_ml;
  }

  if (doseType === "units/hr") {
    if (!finalConc || finalConc.units_per_ml == null) throw new Error("finalConc missing units_per_ml");
    return doseInput / finalConc.units_per_ml;
  }

  if (doseType === "units/kg/hr") {
    if (!finalConc || finalConc.units_per_ml == null) throw new Error("finalConc missing units_per_ml");
    const units_per_hr = doseInput * weightKg;
    return units_per_hr / finalConc.units_per_ml;
  }

  throw new Error("Unsupported dose type: " + doseType);
};

// ---------- validation ----------
InfusionEngine.validateDose = function({doseInput, doseType, drug, weightKg}) {
  // returns {ok:bool, level: "ok"|"soft-warning"|"hard-block", message}
  doseInput = Number(doseInput);
  if (isNaN(doseInput)) return { ok: false, level: "hard-block", message: "Dose is not a number" };

  // convert thresholds in simple way: if weight-based vs absolute mismatch, do heuristic checks
  const range = drug.dose_range || null;
  if (!range) return { ok: true, level: "ok" };

  // If both doseType and drug.primary_unit share 'kg', do direct compare
  const doseIsKgBased = doseType.includes("kg");
  const primaryIsKg = (drug.primary_unit || "").includes("kg");

  if (doseIsKgBased === primaryIsKg) {
    // direct compare to range
    if (doseInput < range.min) {
      return { ok: false, level: "soft-warning", message: `Dose ${doseInput} ${doseType} is below common minimum (${range.min}).` };
    }
    if (doseInput > range.max * 1.2) {
      return { ok: false, level: "hard-block", message: `Dose ${doseInput} ${doseType} exceeds typical maximum (${range.max}). Override required.` };
    }
    if (doseInput > range.max * 0.9) {
      return { ok: true, level: "soft-warning", message: `Dose near upper range (${range.max}). Double-check.` };
    }
    return { ok: true, level: "ok", message: "Dose looks reasonable." };
  } else {
    // mismatch (e.g., requested mg/min but drug primary is mcg/kg/min)
    // We'll do softer checks: extreme values trigger warnings
    const softLow = range.min * 0.5;
    const softHigh = range.max * 2;
    if (doseInput < softLow) return { ok: false, level: "soft-warning", message: `Dose looks unusually low for this drug.` };
    if (doseInput > softHigh) return { ok: false, level: "hard-block", message: `Dose looks unusually high for this drug. Override required.` };
    return { ok: true, level: "ok", message: "Dose outside direct comparators: proceed with care." };
  }
};

// ---------- ampoule calculation & prep instruction ----------
InfusionEngine.suggestPrep = function({drug, chosenVialIndex = 0, dilutionMl = 50, doseInput, doseType, weightKg}) {
  // picks chosenVial from drug.vials
  if (!drug || !drug.vials || drug.vials.length === 0) throw new Error("No vials defined for drug");
  const chosenVial = drug.vials[chosenVialIndex] || drug.vials[0];
  dilutionMl = Number(dilutionMl);
  if (isNaN(dilutionMl) || dilutionMl <= 0) throw new Error("Invalid dilution volume");

  // compute final concentration
  const finalConc = InfusionEngine.computeFinalConcentration(chosenVial, dilutionMl, doseType);

  // compute pump mL/hr
  let mlPerHr;
  try {
    mlPerHr = InfusionEngine.convertDoseToMlPerHr({doseInput, doseType, drug, weightKg, finalConc});
  } catch (e) {
    return { error: e.message };
  }

  // compute how many ampoules/vials are needed to create that final concentration (the "prepare once" question)
  // For simplicity: calculate number ampoules such that total drug in amps >= finalConc (base) * dilutionMl
  // For mg-based vials: vialAmountMg -> convert to mcg if needed
  let vialDrugBaseAmount; // in mcg for mg vials, or units for units vials, or mg for mg-based pathway
  let baseUnit; // "mcg" | "units" | "mg"
  if (chosenVial.strength_mg) {
    vialDrugBaseAmount = chosenVial.strength_mg * 1000; // mcg
    baseUnit = "mcg";
    // finalConc.mcg_per_ml exists
  } else if (chosenVial.strength_units) {
    vialDrugBaseAmount = chosenVial.strength_units; // units
    baseUnit = "units";
  } else {
    // fallback: assume mcg_per_ml exists and multiply
    if (chosenVial.mcg_per_ml) {
      // vial already defines a per-ml concentration instead of vial strength
      // compute total drug in vial = mcg_per_ml * vial volume
      const vialVol = chosenVial.ampoule_volume_ml || chosenVial.volume_ml || 1;
      vialDrugBaseAmount = chosenVial.mcg_per_ml * vialVol;
      baseUnit = "mcg";
    } else {
      vialDrugBaseAmount = 0;
      baseUnit = "unknown";
    }
  }

  // required drug amount to reach finalConc across dilution: finalConc * dilutionMl
  let requiredDrugAmount;
  if (baseUnit === "mcg") {
    requiredDrugAmount = finalConc.mcg_per_ml * dilutionMl;
  } else if (baseUnit === "units") {
    requiredDrugAmount = finalConc.units_per_ml * dilutionMl;
  } else {
    requiredDrugAmount = null;
  }

  let ampoulesToAdd = null;
  if (requiredDrugAmount != null && vialDrugBaseAmount > 0) {
    ampoulesToAdd = Math.ceil(requiredDrugAmount / vialDrugBaseAmount);
  }

  // build human-friendly prep text
  const prepTextParts = [];
  if (ampoulesToAdd !== null) {
    prepTextParts.push(`Add ${ampoulesToAdd} × ${chosenVial.note || (chosenVial.strength_mg ? chosenVial.strength_mg + " mg" : chosenVial.strength_units + " units")} to ${dilutionMl} ml.`);
  } else {
    prepTextParts.push(`Add the chosen vial(s) to ${dilutionMl} ml (final conc calculated).`);
  }

  // If final dilution volume isn't equal to typical syringe volumes (e.g., adding 5 ml to make 50 ml),
  // mention total volume vs syringe volume decision
  prepTextParts.push(`Final concentration: ${finalConc.mcg_per_ml ? finalConc.mcg_per_ml.toFixed(2) + " mcg/ml" : (finalConc.mg_per_ml ? finalConc.mg_per_ml.toFixed(3) + " mg/ml" : (finalConc.units_per_ml ? finalConc.units_per_ml.toFixed(3) + " units/ml" : "N/A"))}.`);
  prepTextParts.push(`Set pump to ${Number(mlPerHr).toFixed(2)} mL/hr for requested dose (${doseInput} ${doseType}).`);

  // include safety notes if drug has some
  const safetyNotes = drug.notes || "";

  // check for max rate violations if defined
  let maxRateWarning = null;
  if (drug.max_rate_mcg_per_min && doseType.includes("mcg")) {
    const numericDose = Number(doseInput);
    if (!isNaN(numericDose) && numericDose > drug.max_rate_mcg_per_min) {
      maxRateWarning = `Requested dose ${numericDose} mcg/min exceeds max recommended (${drug.max_rate_mcg_per_min} mcg/min).`;
    }
  }

  return {
    mlPerHr: Number(mlPerHr),
    finalConc,
    ampoulesToAdd,
    prepText: prepTextParts.join(" "),
    safetyNotes,
    maxRateWarning,
    chosenVial
  };
};

// ---------- override skeleton ----------
InfusionEngine.requestOverride = function({reasonText, userId}) {
  // minimal stub: in real app you'd persist this server-side and require second-nurse verification
  const record = { reasonText, userId, ts: (new Date()).toISOString() };
  // store to localStorage for now
  const key = "infusion_overrides";
  const arr = JSON.parse(localStorage.getItem(key) || "[]");
  arr.push(record);
  localStorage.setItem(key, JSON.stringify(arr));
  return record;
};

// ---------- simple audit log (client-side) ----------
InfusionEngine.logEvent = function(evt) {
  // evt: {type, payload}
  const key = "infusion_events";
  const arr = JSON.parse(localStorage.getItem(key) || "[]");
  arr.push({ ts: (new Date()).toISOString(), evt });
  localStorage.setItem(key, JSON.stringify(arr));
};

// ---------- utility: pretty print ----------
InfusionEngine.formatMlHrForDisplay = function(mlHr) {
  if (mlHr == null || isNaN(mlHr)) return "---";
  return `${Number(mlHr).toFixed(2)} mL/hr`;
};

// ---------- example/test helpers ----------
InfusionEngine.runSelfTest = async function() {
  await this.load();
  console.log("DB loaded. Drugs keys:", Object.keys(this.drugs));
  const drug = this.drugs["nitroglycerin"];
  console.log("Testing nitroglycerin example: 5 mg vial -> 50 ml -> 50 mcg/min for 70 kg patient.");
  const result = this.suggestPrep({
    drug,
    chosenVialIndex: 0,
    dilutionMl: 50,
    doseInput: 50,    // mcg/min
    doseType: "mcg/min",
    weightKg: 70
  });
  console.log("Result:", result);
};

// ---------- export to window for easy UI wiring ----------
window.InfusionEngine = InfusionEngine;
