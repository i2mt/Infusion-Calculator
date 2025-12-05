// Assume `drugs` is loaded from drugs_v2.json and currentDrug is the selected drug object.

function convertDoseToMlPerHr(doseInput, doseType, drug, weightKg, chosenConcentration) {
  // chosenConcentration = amount of drug per ml in the prepared solution, in base units:
  // for mcg/ml (for vasoactives), for mg/ml (for mg drugs), for units/ml (for insulin).
  // This function returns mL/hr for the pump.

  if (!doseInput || !chosenConcentration) return null;

  // Helper conversions
  if (doseType === "mcg/kg/min") {
    // doseInput in mcg/kg/min
    const mcg_per_min = doseInput * weightKg;
    const mcg_per_hr = mcg_per_min * 60;
    return mcg_per_hr / chosenConcentration; // chosenConcentration in mcg/ml -> mL/hr
  }
  if (doseType === "mcg/min") {
    const mcg_per_hr = doseInput * 60;
    return mcg_per_hr / chosenConcentration;
  }
  if (doseType === "mg/min") {
    const mg_per_hr = doseInput * 60;
    // if chosenConcentration is mg/ml
    return mg_per_hr / chosenConcentration;
  }
  if (doseType === "mg/hr") {
    return doseInput / chosenConcentration;
  }
  if (doseType === "units/hr") {
    return doseInput / chosenConcentration; // chosenConcentration units/ml
  }
  if (doseType === "units/kg/hr") {
    const units_per_hr = doseInput * weightKg;
    return units_per_hr / chosenConcentration;
  }

  throw new Error("Unsupported dose type: " + doseType);
}

function validateDose(doseInput, doseType, drug, weightKg) {
  const range = drug.dose_range;
  // For dose ranges we assume the values map to the primary unit.
  // We'll convert if needed — but for simplicity, we will check conversions only for weight-based inputs.
  let numeric = parseFloat(doseInput);
  if (isNaN(numeric)) return { ok: false, message: "Dose is not a number" };

  // If doseType is weight-based but stored min/max are absolute in primary_unit,
  // you may need to convert or use percent flags. Here we do basic checks:
  if (doseType.includes("kg") && drug.primary_unit.includes("kg")) {
    if (numeric < range.min || numeric > range.max) {
      return { ok: false, message: `Dose ${numeric} ${doseType} is outside common range (${range.min}-${range.max})` };
    }
  } else if (!doseType.includes("kg") && !drug.primary_unit.includes("kg")) {
    if (numeric < range.min || numeric > range.max) {
      return { ok: false, message: `Dose ${numeric} ${doseType} is outside common range (${range.min}-${range.max})` };
    }
  } else {
    // Conversion needed — for safety do a softer warning:
    if (numeric < range.min * 0.5 || numeric > range.max * 2) {
      return { ok: false, message: `Dose looks suspicious compared to typical ranges. Please confirm.` };
    }
  }

  return { ok: true };
}

function suggestAmpoulesAndPrep(drug, chosenVial, dilutionMl, requestedDose, doseType, weightKg) {
  // chosenVial: object from drug.vials, e.g. {strength_mg:5, ampoule_volume_ml:5}
  // We compute how many vials needed to reach total drug amount required to reach concentration.
  const strength = chosenVial.strength_mg || chosenVial.strength_units || 0; // unify
  // final concentration if add one vial: strength per (dilutionMl) -> convert to base units (mcg/ml if needed)
  // Example for TNG (mg -> mcg): 5 mg = 5000 mcg
  let basePerMl;
  if (doseType.startsWith("mcg")) {
    // convert mg to mcg if vial given in mg
    if (chosenVial.strength_mg) {
      basePerMl = (chosenVial.strength_mg * 1000) / dilutionMl; // mcg/ml
    } else if (chosenVial.mcg_per_ml) {
      basePerMl = chosenVial.mcg_per_ml / dilutionMl;
    }
  } else if (doseType.startsWith("units")) {
    // units per ml
    if (chosenVial.strength_units) {
      basePerMl = chosenVial.strength_units / dilutionMl;
    }
  } else if (doseType.startsWith("mg")) {
    // mg per ml
    if (chosenVial.strength_mg) {
      basePerMl = chosenVial.strength_mg / dilutionMl;
    }
  }

  // compute required concentration to deliver requested dose and get mL/hr
  // We'll compute mL/hr using convertDoseToMlPerHr and then back-calculate the number of vials necessary
  const chosenConcentration = basePerMl; // in appropriate base units
  const mlPerHr = convertDoseToMlPerHr(requestedDose, doseType, drug, weightKg, chosenConcentration);
  const totalDrugNeededPerHr = null; // optional extra compute

  // To find number of ampoules to add for the chosen dilution (static prep):
  // if you want X mcg/ml final, then amount of drug to add = X * dilutionMl (in mcg). number ampoules = amount / (vial_amount)
  // But typical flow: nurse chooses vial and dilution, we compute final concentration and then the pump rate.

  const finalConc = chosenConcentration; // e.g., mcg/ml
  // Number of ampoules needed to reach that finalConc:
  let vialAmountBase = (chosenVial.strength_mg) ? (chosenVial.strength_mg * 1000) : (chosenVial.strength_units || 0);
  // vialAmountBase in mcg for mg vials or in units for units vials.
  let ampoulesToAdd = vialAmountBase > 0 ? Math.ceil((finalConc * dilutionMl) / vialAmountBase) : 0;

  return {
    mlPerHr: mlPerHr,
    finalConcentrationBasePerMl: finalConc,
    ampoulesToAdd: ampoulesToAdd
  };
}
