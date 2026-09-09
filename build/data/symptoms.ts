/**
 * The symptom taxonomy — hand-curated, frozen at build time.
 *
 * ADR-008. There is no free, safe, machine-readable symptom→OTC dataset. RxClass `may_treat` is the
 * obvious-looking answer and is actively dangerous: its Headache class omits acetaminophen and
 * ibuprofen entirely while including belladonna alkaloids and butalbital; its Cough class includes
 * codeine and cocaine. Runtime use of it is banned.
 *
 * So this table is written by hand, cited to a Health Canada Labelling Standard or Category IV
 * Monograph where one exists, and every row is VALIDATED at build time against the actual catalogue
 * (build/9-build-symptoms.ts). A row that resolves to zero marketed Canadian products fails the
 * build rather than shipping an empty result screen.
 *
 * Six ingredients from the obvious version of this list are deliberately absent, because they have
 * no marketed Canadian non-prescription product: docosanol (so "cold sores" is not offered at all),
 * meclizine, attapulgite, dyclonine, terbinafine (prescription-only in Canada) and adapalene
 * (likewise). They are US-OTC contamination.
 *
 * THE LINE (ADR-008): this app is a product finder indexed by label text, not a symptom checker.
 * A row says "products whose approved label lists this symptom". It never names a condition the
 * user did not type, never ranks by effectiveness, and never calculates a dose.
 */

export type TriageLevel = 0 | 1 | 2

export interface SymptomIngredient {
  /** Must match a `base` in the catalogue exactly. Validated at build time. */
  ingredient: string
  /** What class of medicine this is, in plain words. Shown as a section header. */
  className: string
  /** 1 = first-line. Ranking never mixes classes; it sorts within one and groups across. */
  rank: number
  /** ATC prefix, cross-checked against the catalogue's own ATC code as a QA gate. */
  atcPrefix: string
}

export interface Symptom {
  id: string
  label: string
  /** Drives fuzzy matching from the free-text search box. */
  synonyms: string[]
  /** For the picker's grouping. */
  bodyArea: 'head' | 'chest' | 'stomach' | 'skin' | 'eyes' | 'sleep' | 'general'
  ingredients: SymptomIngredient[]
  /** Verbatim from the monograph — never invented. Drives the soft duration gate. */
  seeSomeoneAfter: string
  source: { title: string; kind: 'HC_LABELLING_STANDARD' | 'HC_CATEGORY_IV' | 'FDA_MONOGRAPH' }
}

export const SYMPTOMS: Symptom[] = [
  {
    id: 'headache', label: 'Headache', bodyArea: 'head',
    synonyms: ['head ache', 'head pain', 'migraine', 'sore head'],
    ingredients: [
      { ingredient: 'ACETAMINOPHEN', className: 'Pain reliever / fever reducer', rank: 1, atcPrefix: 'N02' },
      { ingredient: 'IBUPROFEN', className: 'Anti-inflammatory pain reliever', rank: 1, atcPrefix: 'M01' },
      { ingredient: 'ACETYLSALICYLIC ACID', className: 'Anti-inflammatory pain reliever', rank: 2, atcPrefix: 'N02' },
      { ingredient: 'NAPROXEN', className: 'Anti-inflammatory pain reliever', rank: 2, atcPrefix: 'M01' },
    ],
    seeSomeoneAfter: 'pain lasting more than 5 days',
    source: { title: 'Health Canada Acetaminophen Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'fever', label: 'Fever', bodyArea: 'general',
    synonyms: ['temperature', 'high temperature', 'chills'],
    ingredients: [
      { ingredient: 'ACETAMINOPHEN', className: 'Fever reducer', rank: 1, atcPrefix: 'N02' },
      { ingredient: 'IBUPROFEN', className: 'Fever reducer', rank: 1, atcPrefix: 'M01' },
    ],
    seeSomeoneAfter: 'fever lasting more than 3 days',
    source: { title: 'Health Canada Acetaminophen Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'muscle-joint-pain', label: 'Muscle or joint pain', bodyArea: 'general',
    synonyms: ['backache', 'back pain', 'sore muscles', 'arthritis', 'sprain', 'strain', 'aches'],
    ingredients: [
      { ingredient: 'IBUPROFEN', className: 'Oral anti-inflammatory', rank: 1, atcPrefix: 'M01' },
      { ingredient: 'NAPROXEN', className: 'Oral anti-inflammatory', rank: 1, atcPrefix: 'M01' },
      { ingredient: 'ACETAMINOPHEN', className: 'Oral pain reliever', rank: 2, atcPrefix: 'N02' },
      { ingredient: 'DICLOFENAC DIETHYLAMINE', className: 'Topical anti-inflammatory', rank: 2, atcPrefix: 'M02' },
      { ingredient: 'TROLAMINE SALICYLATE', className: 'Topical pain reliever', rank: 3, atcPrefix: 'M02' },
      { ingredient: 'MENTHOL', className: 'Topical counterirritant', rank: 3, atcPrefix: 'M02' },
      { ingredient: 'CAPSAICIN', className: 'Topical counterirritant', rank: 3, atcPrefix: 'M02' },
    ],
    seeSomeoneAfter: 'pain lasting more than 10 days',
    source: { title: 'Health Canada Topical Analgesic/Antipruritic Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'menstrual-cramps', label: 'Menstrual cramps', bodyArea: 'stomach',
    synonyms: ['period pain', 'period cramps', 'pms', 'dysmenorrhea'],
    ingredients: [
      { ingredient: 'IBUPROFEN', className: 'Anti-inflammatory pain reliever', rank: 1, atcPrefix: 'M01' },
      { ingredient: 'NAPROXEN', className: 'Anti-inflammatory pain reliever', rank: 1, atcPrefix: 'M01' },
      { ingredient: 'ACETAMINOPHEN', className: 'Pain reliever', rank: 2, atcPrefix: 'N02' },
      { ingredient: 'PAMABROM', className: 'Diuretic for bloating', rank: 3, atcPrefix: 'N02' },
    ],
    seeSomeoneAfter: 'pain lasting more than 5 days',
    source: { title: 'Health Canada Acetaminophen Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'sore-throat', label: 'Sore throat', bodyArea: 'chest',
    synonyms: ['throat pain', 'scratchy throat', 'strep'],
    ingredients: [
      { ingredient: 'HEXYLRESORCINOL', className: 'Throat anaesthetic', rank: 1, atcPrefix: 'R02' },
      { ingredient: 'DICHLOROBENZYL ALCOHOL', className: 'Throat antiseptic', rank: 1, atcPrefix: 'R02' },
      { ingredient: 'AMYLMETACRESOL', className: 'Throat antiseptic', rank: 1, atcPrefix: 'R02' },
      { ingredient: 'CETYLPYRIDINIUM CHLORIDE', className: 'Throat antiseptic', rank: 2, atcPrefix: 'R02' },
      // No LIDOCAINE here: every lidocaine product in the Canadian OTC catalogue is a topical
      // wound antibiotic (ATC D06), not a throat preparation. It would resolve to Polysporin.
      { ingredient: 'ACETAMINOPHEN', className: 'Pain reliever', rank: 3, atcPrefix: 'N02' },
    ],
    seeSomeoneAfter: 'a sore throat lasting more than 2 days',
    source: { title: 'Health Canada Category IV Monograph: Throat Lozenges', kind: 'HC_CATEGORY_IV' },
  },
  {
    id: 'nasal-congestion', label: 'Blocked nose', bodyArea: 'head',
    synonyms: ['stuffy nose', 'congestion', 'sinus', 'blocked sinuses', 'nasal congestion'],
    ingredients: [
      { ingredient: 'PSEUDOEPHEDRINE', className: 'Oral decongestant', rank: 1, atcPrefix: 'R01' },
      { ingredient: 'XYLOMETAZOLINE', className: 'Nasal spray decongestant', rank: 1, atcPrefix: 'R01' },
      { ingredient: 'OXYMETAZOLINE', className: 'Nasal spray decongestant', rank: 1, atcPrefix: 'R01' },
      // Only ever appears in multi-ingredient cold products in this catalogue, so it ranks last.
      { ingredient: 'PHENYLEPHRINE', className: 'Decongestant in combination products', rank: 3, atcPrefix: 'R01' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 7 days',
    source: { title: 'Health Canada Topical Nasal Decongestants Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'allergies', label: 'Runny nose, sneezing or allergies', bodyArea: 'head',
    synonyms: ['hay fever', 'allergy', 'sneezing', 'runny nose', 'itchy eyes', 'rhinitis', 'pollen'],
    ingredients: [
      { ingredient: 'CETIRIZINE', className: 'Non-drowsy antihistamine', rank: 1, atcPrefix: 'R06' },
      { ingredient: 'LORATADINE', className: 'Non-drowsy antihistamine', rank: 1, atcPrefix: 'R06' },
      { ingredient: 'FEXOFENADINE', className: 'Non-drowsy antihistamine', rank: 1, atcPrefix: 'R06' },
      { ingredient: 'DESLORATADINE', className: 'Non-drowsy antihistamine', rank: 1, atcPrefix: 'R06' },
      { ingredient: 'DIPHENHYDRAMINE', className: 'Antihistamine (causes drowsiness)', rank: 2, atcPrefix: 'R06' },
      { ingredient: 'CHLORPHENIRAMINE', className: 'Antihistamine (causes drowsiness)', rank: 2, atcPrefix: 'R06' },
      { ingredient: 'FLUTICASONE PROPIONATE', className: 'Steroid nasal spray', rank: 2, atcPrefix: 'R01' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 7 days',
    source: { title: 'Health Canada Non-prescription Oral Adult Cough, Cold and Flu Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'cough', label: 'Cough', bodyArea: 'chest',
    synonyms: ['coughing', 'chest congestion', 'phlegm', 'mucus', 'dry cough'],
    ingredients: [
      { ingredient: 'DEXTROMETHORPHAN', className: 'Cough suppressant', rank: 1, atcPrefix: 'R05' },
      { ingredient: 'GUAIFENESIN', className: 'Expectorant (loosens mucus)', rank: 1, atcPrefix: 'R05' },
      { ingredient: 'CLOFEDANOL', className: 'Cough suppressant', rank: 2, atcPrefix: 'R05' },
    ],
    seeSomeoneAfter: 'a cough lasting more than 7 days',
    source: { title: 'Health Canada Non-prescription Oral Adult Antitussive Cough and Cold Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'heartburn', label: 'Heartburn or acid reflux', bodyArea: 'stomach',
    synonyms: ['acid reflux', 'indigestion', 'acid', 'gerd', 'burning chest'],
    ingredients: [
      { ingredient: 'CALCIUM CARBONATE', className: 'Antacid (works in minutes)', rank: 1, atcPrefix: 'A02' },
      { ingredient: 'MAGNESIUM HYDROXIDE', className: 'Antacid (works in minutes)', rank: 1, atcPrefix: 'A02' },
      { ingredient: 'ALUMINUM HYDROXIDE', className: 'Antacid (works in minutes)', rank: 1, atcPrefix: 'A02' },
      { ingredient: 'FAMOTIDINE', className: 'Acid reducer (lasts longer)', rank: 2, atcPrefix: 'A02' },
      { ingredient: 'OMEPRAZOLE', className: 'Acid blocker (for frequent heartburn)', rank: 3, atcPrefix: 'A02' },
      { ingredient: 'ESOMEPRAZOLE', className: 'Acid blocker (for frequent heartburn)', rank: 3, atcPrefix: 'A02' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 2 weeks',
    source: { title: 'Health Canada Antacids Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'upset-stomach', label: 'Upset stomach', bodyArea: 'stomach',
    synonyms: ['indigestion', 'stomach ache', 'sour stomach', 'queasy'],
    ingredients: [
      { ingredient: 'BISMUTH SUBSALICYLATE', className: 'Stomach protectant', rank: 1, atcPrefix: 'A07' },
      { ingredient: 'CALCIUM CARBONATE', className: 'Antacid', rank: 1, atcPrefix: 'A02' },
      { ingredient: 'CHARCOAL ACTIVATED', className: 'Adsorbent', rank: 3, atcPrefix: 'A07' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 2 days',
    source: { title: 'Health Canada Bismuth Subsalicylate Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'gas-bloating', label: 'Gas or bloating', bodyArea: 'stomach',
    synonyms: ['bloated', 'wind', 'flatulence', 'trapped gas'],
    ingredients: [
      { ingredient: 'SIMETHICONE', className: 'Anti-gas', rank: 1, atcPrefix: 'A03' },
      { ingredient: 'DIMETHICONE', className: 'Anti-gas', rank: 2, atcPrefix: 'A03' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 2 weeks',
    source: { title: 'Health Canada Antiflatulents Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'nausea', label: 'Nausea or motion sickness', bodyArea: 'stomach',
    synonyms: ['travel sickness', 'car sickness', 'sea sickness', 'feeling sick', 'vomiting', 'queasy'],
    ingredients: [
      { ingredient: 'DIMENHYDRINATE', className: 'Anti-nausea antihistamine', rank: 1, atcPrefix: 'R06' },
      { ingredient: 'PROMETHAZINE', className: 'Anti-nausea antihistamine', rank: 2, atcPrefix: 'R06' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 2 days',
    source: { title: 'Health Canada Dimenhydrinate Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'diarrhea', label: 'Diarrhea', bodyArea: 'stomach',
    synonyms: ['loose stools', 'the runs', 'upset bowels'],
    ingredients: [
      { ingredient: 'LOPERAMIDE', className: 'Anti-diarrhoeal', rank: 1, atcPrefix: 'A07' },
      { ingredient: 'BISMUTH SUBSALICYLATE', className: 'Stomach protectant', rank: 2, atcPrefix: 'A07' },
    ],
    seeSomeoneAfter: 'diarrhea lasting more than 2 days',
    source: { title: 'Health Canada Bismuth Subsalicylate Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'constipation', label: 'Constipation', bodyArea: 'stomach',
    synonyms: ['blocked', 'cannot go', 'hard stools', 'irregular'],
    ingredients: [
      { ingredient: 'POLYETHYLENE GLYCOL 3350', className: 'Osmotic laxative', rank: 1, atcPrefix: 'A06' },
      { ingredient: 'DOCUSATE', className: 'Stool softener', rank: 1, atcPrefix: 'A06' },
      { ingredient: 'SENNOSIDES', className: 'Stimulant laxative', rank: 2, atcPrefix: 'A06' },
      { ingredient: 'BISACODYL', className: 'Stimulant laxative', rank: 2, atcPrefix: 'A06' },
      { ingredient: 'LACTULOSE', className: 'Osmotic laxative', rank: 2, atcPrefix: 'A06' },
      { ingredient: 'MAGNESIUM HYDROXIDE', className: 'Osmotic laxative', rank: 2, atcPrefix: 'A06' },
      { ingredient: 'MINERAL OIL', className: 'Lubricant laxative', rank: 3, atcPrefix: 'A06' },
    ],
    seeSomeoneAfter: 'a sudden change in bowel habits lasting more than 2 weeks',
    source: { title: 'Health Canada Laxative Labelling Standards', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'insomnia', label: 'Trouble sleeping', bodyArea: 'sleep',
    synonyms: [
      'insomnia', 'cannot sleep', 'can not sleep', 'cant sleep', 'sleep', 'sleeping',
      'sleepless', 'sleep aid', 'sleeping pill', 'sleep problems', 'trouble sleeping',
      'awake at night', 'restless',
    ],
    ingredients: [
      { ingredient: 'DIPHENHYDRAMINE', className: 'Night-time sleep aid', rank: 1, atcPrefix: 'R06' },
      // No DOXYLAMINE here: all 23 Canadian doxylamine products are multi-ingredient cold and flu
      // combinations (ATC N02BE51), so offering it for sleep would recommend NyQuil.
    ],
    seeSomeoneAfter: 'sleeplessness lasting more than 2 weeks',
    source: { title: 'Health Canada Sleep Aids Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'itchy-skin', label: 'Itchy skin or rash', bodyArea: 'skin',
    synonyms: ['itch', 'rash', 'eczema', 'hives', 'bug bite', 'insect bite', 'poison ivy'],
    ingredients: [
      { ingredient: 'HYDROCORTISONE', className: 'Anti-itch steroid cream', rank: 1, atcPrefix: 'D07' },
      // D07, not D04: every topical pramoxine product here is a hydrocortisone combination.
      // Declaring D04 dropped them all, and before the ATC gate was enforced it admitted the
      // RECTAL Anusol suppository as the top result for itchy skin.
      { ingredient: 'PRAMOXINE', className: 'Anti-itch anaesthetic', rank: 1, atcPrefix: 'D07' },
      { ingredient: 'CLOBETASONE BUTYRATE', className: 'Anti-itch steroid cream', rank: 2, atcPrefix: 'D07' },
      { ingredient: 'DIPHENHYDRAMINE', className: 'Oral antihistamine', rank: 2, atcPrefix: 'R06' },
    ],
    seeSomeoneAfter: 'a rash lasting more than 7 days',
    source: { title: 'Health Canada Topical Analgesic/Anaesthetic/Antipruritic Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'minor-cuts', label: 'Minor cuts and scrapes', bodyArea: 'skin',
    synonyms: ['cut', 'graze', 'scrape', 'wound', 'burn', 'blister'],
    ingredients: [
      { ingredient: 'POLYMYXIN B', className: 'First-aid antibiotic', rank: 1, atcPrefix: 'D06' },
      { ingredient: 'BACITRACIN', className: 'First-aid antibiotic', rank: 1, atcPrefix: 'D06' },
      { ingredient: 'BACITRACIN ZINC', className: 'First-aid antibiotic', rank: 1, atcPrefix: 'D06' },
      { ingredient: 'GRAMICIDIN', className: 'First-aid antibiotic', rank: 2, atcPrefix: 'D06' },
      { ingredient: 'MUPIROCIN', className: 'First-aid antibiotic', rank: 2, atcPrefix: 'D06' },
      { ingredient: 'LIDOCAINE', className: 'Antibiotic with pain relief', rank: 2, atcPrefix: 'D06' },
    ],
    seeSomeoneAfter: 'no improvement in 7 days',
    source: { title: 'Health Canada Topical Antibiotics Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'dry-eyes', label: 'Dry or irritated eyes', bodyArea: 'eyes',
    synonyms: ['dry eye', 'sore eyes', 'red eyes', 'tired eyes', 'eye drops', 'gritty eyes'],
    ingredients: [
      { ingredient: 'CARBOXYMETHYLCELLULOSE', className: 'Lubricating eye drops', rank: 1, atcPrefix: 'S01' },
      { ingredient: 'HYPROMELLOSE', className: 'Lubricating eye drops', rank: 1, atcPrefix: 'S01' },
      { ingredient: 'POLYVINYL ALCOHOL', className: 'Lubricating eye drops', rank: 1, atcPrefix: 'S01' },
      { ingredient: 'GLYCERINE', className: 'Lubricating eye drops', rank: 2, atcPrefix: 'S01' },
      { ingredient: 'POLYETHYLENE GLYCOL 400', className: 'Lubricating eye drops', rank: 2, atcPrefix: 'S01' },
      { ingredient: 'NAPHAZOLINE', className: 'Redness reliever', rank: 3, atcPrefix: 'S01' },
      { ingredient: 'TETRAHYDROZOLINE', className: 'Redness reliever', rank: 3, atcPrefix: 'S01' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 3 days',
    source: { title: 'FDA OTC Monograph M018 (Ophthalmic)', kind: 'FDA_MONOGRAPH' },
  },
  {
    id: 'hemorrhoids', label: 'Hemorrhoids', bodyArea: 'general',
    synonyms: ['piles', 'anal itching', 'rectal discomfort'],
    ingredients: [
      { ingredient: 'PRAMOXINE', className: 'Anaesthetic for relief', rank: 1, atcPrefix: 'C05' },
      { ingredient: 'PHENYLEPHRINE', className: 'Vasoconstrictor', rank: 1, atcPrefix: 'C05' },
      { ingredient: 'ZINC', className: 'Skin protectant', rank: 2, atcPrefix: 'C05' },
      { ingredient: 'HAMAMELIS VIRGINIANA', className: 'Astringent (witch hazel)', rank: 2, atcPrefix: 'C05' },
    ],
    seeSomeoneAfter: 'symptoms lasting more than 7 days',
    source: { title: 'Health Canada Anorectal Drug Products Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'athletes-foot', label: "Athlete's foot or fungal skin", bodyArea: 'skin',
    synonyms: ['fungus', 'jock itch', 'ringworm', 'foot fungus', 'yeast'],
    ingredients: [
      { ingredient: 'CLOTRIMAZOLE', className: 'Antifungal', rank: 1, atcPrefix: 'D01' },
      { ingredient: 'MICONAZOLE', className: 'Antifungal', rank: 1, atcPrefix: 'D01' },
      { ingredient: 'TOLNAFTATE', className: 'Antifungal', rank: 1, atcPrefix: 'D01' },
      { ingredient: 'NYSTATIN', className: 'Antifungal', rank: 2, atcPrefix: 'D01' },
      { ingredient: 'KETOCONAZOLE', className: 'Antifungal', rank: 2, atcPrefix: 'D01' },
    ],
    seeSomeoneAfter: 'no improvement in 4 weeks',
    source: { title: 'Health Canada Topical Antifungals Labelling Standard', kind: 'HC_LABELLING_STANDARD' },
  },
  {
    id: 'acne', label: 'Acne', bodyArea: 'skin',
    synonyms: ['spots', 'pimples', 'breakout', 'blackheads', 'zits'],
    ingredients: [
      { ingredient: 'BENZOYL PEROXIDE', className: 'Acne treatment', rank: 1, atcPrefix: 'D10' },
      { ingredient: 'SALICYLIC ACID', className: 'Acne treatment', rank: 2, atcPrefix: 'D10' },
    ],
    seeSomeoneAfter: 'no improvement in 12 weeks',
    source: { title: 'Health Canada Category IV Monograph: Acne Therapy', kind: 'HC_CATEGORY_IV' },
  },
  {
    id: 'dandruff', label: 'Dandruff', bodyArea: 'skin',
    synonyms: ['flaky scalp', 'itchy scalp', 'seborrheic'],
    ingredients: [
      { ingredient: 'PYRITHIONE ZINC', className: 'Anti-dandruff', rank: 1, atcPrefix: 'D11' },
      { ingredient: 'KETOCONAZOLE', className: 'Anti-dandruff antifungal', rank: 2, atcPrefix: 'D01' },
    ],
    seeSomeoneAfter: 'no improvement in 4 weeks',
    source: { title: 'Health Canada Category IV Monograph: Anti-Dandruff Products', kind: 'HC_CATEGORY_IV' },
  },
]

/**
 * TIER 2 — hard stop. No products are shown and there is no "continue anyway" button.
 * These are the presentations where reaching for a shelf medicine is the wrong action.
 *
 * `pattern` is a REGULAR EXPRESSION SOURCE, not a substring. The first version used plain
 * containment and failed both ways: "coughing up blood" did not match the literal "coughing blood"
 * and was answered with dextromethorphan; "bloody diarrhea" was answered with loperamide, which is
 * contraindicated in bloody diarrhoea; while "heat stroke" and "food poisoning" were hard-blocked
 * with a Call 911 screen because they contained "stroke" and "poisoning".
 *
 * Patterns are matched case-insensitively against a normalised query (punctuation stripped, so
 * "can't" becomes "can t"). Keep them anchored on word boundaries and allow filler words between
 * the parts people actually type.
 */
export const RED_FLAGS: { id: string; label: string; pattern: string }[] = [
  {
    id: 'chest-pain',
    label: 'Chest pain, pressure or tightness',
    pattern: String.raw`\b(chest\s+(pain|pressure|tight|tightness|hurt\w*|discomfort)|(pain|pressure|tightness|crushing|squeezing)\s+(\w+\s+){0,3}chest|heart\s*attack|angina)\b`,
  },
  {
    id: 'breathing',
    label: 'Difficulty breathing or shortness of breath',
    pattern: String.raw`\b(can\s*(not|t)\s+breath\w*|cannot\s+breath\w*|trouble\s+breath\w*|difficulty\s+breath\w*|short(ness)?\s+of\s+breath|struggling\s+to\s+breath\w*|gasping|choking|turning\s+blue)\b`,
  },
  {
    id: 'thunderclap',
    label: 'Sudden severe headache, or headache with a stiff neck or confusion',
    pattern: String.raw`\b((worst|sudden|severe|thunderclap)\s+(\w+\s+){0,2}head\s*ache|head\s*ache\s+(\w+\s+){0,3}(stiff\s+neck|confus\w+|vision|light\s+hurts)|stiff\s+neck)\b`,
  },
  {
    id: 'stroke',
    label: 'Weakness on one side, drooping face, or slurred speech',
    pattern: String.raw`\b(one\s+side\s+(\w+\s+){0,2}(weak|numb)|face\s+(is\s+)?droop\w*|drooping\s+face|slur\w+\s+speech|cannot\s+speak|can\s*t\s+speak|having\s+a\s+stroke|signs\s+of\s+(a\s+)?stroke)\b`,
  },
  {
    id: 'bleeding',
    label: 'Coughing or vomiting blood, or blood in your stool',
    pattern: String.raw`\b((cough\w*|vomit\w*|throw\w*|spit\w*|puk\w*)\s+(up\s+)?blood|blood\s+(in|when|from)\s+(\w+\s+){0,3}(stool\w*|poo\w*|vomit\w*|urine|pee|rectum|bowel\w*)|bloody\s+(stool\w*|diarrh\w*|vomit\w*|poo\w*)|(black|tarry)\s+(and\s+)?(tarry\s+)?stool\w*|melena|haemoptysis|hematemesis)\b`,
  },
  {
    id: 'severe-abdo',
    label: 'Sudden severe abdominal pain',
    pattern: String.raw`\b((severe|sudden|agonis\w+|agoniz\w+|unbearable)\s+(\w+\s+){0,2}(abdominal|stomach|belly|tummy)\s*(pain|ache|cramp\w*)?|appendicitis)\b`,
  },
  {
    id: 'fainting',
    label: 'Fainting or loss of consciousness',
    pattern: String.raw`\b(faint(ed|ing)?|passed\s+out|pass(ing)?\s+out|unconscious|black(ed)?\s+out|collapsed)\b`,
  },
  {
    id: 'overdose',
    label: 'Suspected overdose or poisoning',
    // "food poisoning" and "heat stroke" must NOT trigger this, so poisoning is only a flag when
    // it is about a person having taken or swallowed something.
    pattern: String.raw`\b(overdose|od\s+on|took\s+(too\s+many|\d+)|swallowed\s+(\w+\s+){0,3}(pill|tablet|medicine|bleach|battery)|drank\s+(bleach|chemical)|poisoned|(?<!food\s)(?<!heat\s)poisoning\s+(emergency|help))\b`,
  },
]

/**
 * TIER 1 — soft gate. One tap to continue, shown above the results.
 * The under-6 cough/cold gate is the exception: it is a hard block, per Health Canada's
 * 2008-12-18 decision that cough and cold products are not to be used in children under six.
 */
export const CAUTIONS = {
  underSixHardBlock: ['nasal-congestion', 'allergies', 'cough'],
  /**
   * Detecting "this is for a small child". The first version was a fixed word list with no notion
   * of an age, so it fired for "my son" at any age and missed every numeric phrasing —
   * "cough medicine for my 2 year old", "for my 6 month old", even "cough under 6".
   * These patterns parse the age; the word list is kept only for genuinely age-implying nouns.
   */
  youngChildPatterns: [
    // 0-5 years, written any of the usual ways
    String.raw`\b([0-5])\s*(year|yr|y)s?\s*(old)?\b`,
    String.raw`\b([0-5])\s*yo\b`,
    // any age in months is under six years
    String.raw`\b(\d{1,2})\s*(month|mo|mth)s?\s*(old)?\b`,
    // the ADR's own wording
    String.raw`\bunder\s*(6|six)\b`,
    String.raw`\b(6|six)\s*(and\s+)?under\b`,
    // nouns that mean a child too young for these products regardless of a stated age
    String.raw`\b(baby|babies|infant|newborn|toddler|nursing)\b`,
  ],
  general: [
    'Are you pregnant or breastfeeding?',
    'Is this for someone under 12, or over 65?',
    'Are you taking any other medicines, including prescriptions?',
    'Do you have a long-term condition such as asthma, kidney or liver problems, or high blood pressure?',
  ],
}
