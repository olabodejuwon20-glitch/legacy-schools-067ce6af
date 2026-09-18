-- Rule-based topic inference for mock/CBT questions so topic accuracy bars show real syllabus topics.
CREATE OR REPLACE FUNCTION public.infer_mock_topic(_subject text, _prompt text, _explanation text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text := lower(coalesce(_subject, ''));
  t text := lower(coalesce(_prompt, '') || ' ' || coalesce(_explanation, ''));
BEGIN
  -- Seeded placeholder questions: label explicitly rather than leaving them untagged.
  IF t ~ 'sample question' OR t ~ 'choose the option that best completes the sentence' THEN
    RETURN 'General Revision';
  END IF;

  IF s LIKE '%mathematics%' THEN
    IF t ~ '(matrix|matrices|determinant)' THEN RETURN 'Matrices & Determinants'; END IF;
    IF t ~ '(sin|cos|tan|bearing|trigonom)' THEN RETURN 'Trigonometry'; END IF;
    IF t ~ '(probabilit|dice|coin|at random)' THEN RETURN 'Probability'; END IF;
    IF t ~ '(mean|median|mode|standard deviation|frequency table|histogram|variance)' THEN RETURN 'Statistics'; END IF;
    IF t ~ '(differentiat|derivative|integrat|dy/dx|∫)' THEN RETURN 'Calculus'; END IF;
    IF t ~ '(logarithm|log\W|indices|surd|√)' THEN RETURN 'Indices, Logarithms & Surds'; END IF;
    IF t ~ '(circle|triangle|polygon|angle|parallelogram|area of|volume of|cylinder|cone|sphere|perimeter)' THEN RETURN 'Geometry & Mensuration'; END IF;
    IF t ~ '(quadratic|x²|x\^2|roots of the equation|factoris)' THEN RETURN 'Quadratic Equations'; END IF;
    IF t ~ '(gradient|straight line|coordinate|intersect at|midpoint)' THEN RETURN 'Coordinate Geometry'; END IF;
    IF t ~ '(sequence|arithmetic progression|geometric progression|nth term|\ba\.p\b|\bg\.p\b)' THEN RETURN 'Sequences & Series'; END IF;
    IF t ~ '(simple interest|compound interest|profit|discount|percentage|ratio|proportion)' THEN RETURN 'Commercial Arithmetic'; END IF;
    IF t ~ '(set|venn|union|intersection of)' THEN RETURN 'Sets'; END IF;
    IF t ~ '(number base|base (two|eight|five)|binary)' THEN RETURN 'Number Bases'; END IF;
    IF t ~ '(solve|value of x|simplify|inequalit|equation)' THEN RETURN 'Algebraic Equations'; END IF;
    RETURN 'Numbers & Numeration';
  END IF;

  IF s LIKE '%biology%' THEN
    IF t ~ '(chromosome|gene|allele|dominant|recessive|heredit|dna|mutation)' THEN RETURN 'Genetics & Heredity'; END IF;
    IF t ~ '(evolution|common ancestry|natural selection|fossil|adaptive)' THEN RETURN 'Evolution & Adaptation'; END IF;
    IF t ~ '(food chain|ecosystem|habitat|savanna|population|symbio|parasit|energy flow|conservation)' THEN RETURN 'Ecology'; END IF;
    IF t ~ '(nerve|impulse|neuron|action potential|hormone|reflex|brain|sense organ)' THEN RETURN 'Nervous & Hormonal Coordination'; END IF;
    IF t ~ '(blood|heart|pericardium|circulat|lymph|artery|vein|transport)' THEN RETURN 'Transport Systems'; END IF;
    IF t ~ '(enzyme|glycoly|respirat|photosynth|digest|nutrition|metabol)' THEN RETURN 'Nutrition & Respiration'; END IF;
    IF t ~ '(testis|ovary|gamete|fertilis|reproduc|life cycle|spore|pollin)' THEN RETURN 'Reproduction'; END IF;
    IF t ~ '(cell|osmosis|diffusion|tissue|membrane|mitosis|meiosis)' THEN RETURN 'Cell Biology'; END IF;
    IF t ~ '(disease|malaria|infect|hygiene|drancunculiasis|vaccine|pathogen)' THEN RETURN 'Health & Disease'; END IF;
    RETURN 'Living Organisms & Classification';
  END IF;

  IF s LIKE '%chemistry%' THEN
    IF t ~ '(electroly|cathode|anode|electroplat|cell potential)' THEN RETURN 'Electrochemistry'; END IF;
    IF t ~ '(oxidation number|redox|reducing agent|oxidis)' THEN RETURN 'Redox Reactions'; END IF;
    IF t ~ '(endotherm|exotherm|enthalpy|heat of reaction|thermochem)' THEN RETURN 'Energetics'; END IF;
    IF t ~ '(catalyst|rate of reaction|equilibri|le chatelier)' THEN RETURN 'Rates & Equilibrium'; END IF;
    IF t ~ '(periodic table|group |period |atomic number|electron configuration|isotope)' THEN RETURN 'Atomic Structure & Periodicity'; END IF;
    IF t ~ '(bond|ionic|covalent|metallic|lattice)' THEN RETURN 'Chemical Bonding'; END IF;
    IF t ~ '(acid|base|alkali|ph |titrat|precipitate|salt)' THEN RETURN 'Acids, Bases & Salts'; END IF;
    IF t ~ '(alkane|alkene|alkyne|alcohol|ester|organic|hydrocarbon|polymer)' THEN RETURN 'Organic Chemistry'; END IF;
    IF t ~ '(mole|molar|stoichiom|empirical formula|avogadro|volume of gas)' THEN RETURN 'Stoichiometry & Gas Laws'; END IF;
    IF t ~ '(alloy|alnico|metal|extraction|corrosion|ore)' THEN RETURN 'Metals & Extraction'; END IF;
    RETURN 'General Chemistry';
  END IF;

  IF s LIKE '%physics%' THEN
    IF t ~ '(current|voltage|resistor|resistance|capacitor|circuit|ohm)' THEN RETURN 'Current Electricity'; END IF;
    IF t ~ '(magnet|induction|transformer|solenoid|flux)' THEN RETURN 'Magnetism & Induction'; END IF;
    IF t ~ '(lens|mirror|refract|wavelength|frequency|sound|light|wave)' THEN RETURN 'Waves, Light & Sound'; END IF;
    IF t ~ '(heat|temperature|thermal|specific heat|expansion|gas law)' THEN RETURN 'Heat & Thermal Physics'; END IF;
    IF t ~ '(radioactiv|nucleus|half-life|photoelectric|quantum|isotope)' THEN RETURN 'Atomic & Nuclear Physics'; END IF;
    IF t ~ '(velocity|acceleration|momentum|force|newton|projectile|friction|motion)' THEN RETURN 'Mechanics & Motion'; END IF;
    IF t ~ '(pressure|density|upthrust|archimedes|surface tension|viscosity|fluid)' THEN RETURN 'Fluids & Pressure'; END IF;
    IF t ~ '(work|energy|power|machine|efficiency)' THEN RETURN 'Work, Energy & Power'; END IF;
    RETURN 'Measurement & General Physics';
  END IF;

  IF s LIKE '%economics%' THEN
    IF t ~ '(demand|supply|elasticit|price mechanism|equilibrium price)' THEN RETURN 'Demand & Supply'; END IF;
    IF t ~ '(foreign exchange|balance of payment|export|import|tariff|trade)' THEN RETURN 'International Trade'; END IF;
    IF t ~ '(bank|money|inflation|interest rate|monetary)' THEN RETURN 'Money & Banking'; END IF;
    IF t ~ '(tax|budget|government spending|fiscal|public finance)' THEN RETURN 'Public Finance'; END IF;
    IF t ~ '(labour|wage|unemploy|population|migration)' THEN RETURN 'Labour & Population'; END IF;
    IF t ~ '(cost|revenue|profit|firm|monopol|perfect competition|production)' THEN RETURN 'Production & Market Structures'; END IF;
    IF t ~ '(agricultur|petroleum|industrialis|development plan|nigeria)' THEN RETURN 'Nigerian Economy'; END IF;
    RETURN 'Basic Economic Concepts';
  END IF;

  IF s LIKE '%government%' OR s LIKE '%civic%' THEN
    IF t ~ '(constitution|rule of law|fundamental human right|separation of power)' THEN RETURN 'Constitution & Rule of Law'; END IF;
    IF t ~ '(election|electoral|suffrage|political part|campaign)' THEN RETURN 'Elections & Political Parties'; END IF;
    IF t ~ '(federal|unitary|confederal|local government|state)' THEN RETURN 'Systems & Structures of Government'; END IF;
    IF t ~ '(colonial|independence|amalgamation|nationalis|republic|military rule)' THEN RETURN 'Nigerian Political History'; END IF;
    IF t ~ '(united nations|ecowas|african union|commonwealth|opec|foreign policy)' THEN RETURN 'International Organisations'; END IF;
    IF t ~ '(citizen|civic|duty|responsibilit|human right)' THEN RETURN 'Citizenship & Civic Duties'; END IF;
    RETURN 'Basic Concepts of Government';
  END IF;

  IF s LIKE '%english%' THEN
    IF t ~ '(nearest in meaning|synonym|closest in meaning)' THEN RETURN 'Synonyms'; END IF;
    IF t ~ '(opposite in meaning|antonym)' THEN RETURN 'Antonyms'; END IF;
    IF t ~ '(stress|vowel|consonant|rhyme|pronounc|syllable)' THEN RETURN 'Oral English'; END IF;
    IF t ~ '(passage|according to the author|comprehension)' THEN RETURN 'Comprehension'; END IF;
    IF t ~ '(idiom|expression means|figure of speech|metaphor)' THEN RETURN 'Idioms & Figurative Use'; END IF;
    RETURN 'Grammar & Structure';
  END IF;

  RETURN initcap(coalesce(_subject, 'General')) || ' — Core Topics';
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_mock_question_topic()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE sname text;
BEGIN
  IF NEW.topic IS NULL OR btrim(NEW.topic) = '' THEN
    SELECT name INTO sname FROM public.mock_subjects WHERE id = NEW.subject_id;
    NEW.topic := public.infer_mock_topic(sname, NEW.prompt, NEW.explanation);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mock_questions_set_topic ON public.mock_questions;
CREATE TRIGGER mock_questions_set_topic
BEFORE INSERT OR UPDATE OF prompt, subject_id ON public.mock_questions
FOR EACH ROW EXECUTE FUNCTION public.tg_mock_question_topic();