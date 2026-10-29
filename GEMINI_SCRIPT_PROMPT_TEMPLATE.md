# 🎬 CavePaint — Gemini Script Generation Prompt Template

Use this template in the **Gemini Web UI** (or Claude / ChatGPT) to turn any video idea into a deeply researched, fact-backed, and entertaining **Khmer narrative script** ready to paste straight into CavePaint.

---

## 📋 How to Use:
1. Copy the **Master Prompt Template** below.
2. Fill in the **`[INPUT CONFIGURATION]`** placeholders (Title, Brief, Duration, Era, Region, Tone).
3. Paste into **Gemini Web UI** (`gemini.google.com`).
4. Copy Gemini's output directly into **CavePaint Studio (Brainstorming Tab > Narrative Script)**.
5. Click **"Auto-Break"** in CavePaint to automatically convert each line into a scene!

---

## 📝 1. Master Prompt Template (For Copy-Pasting)

```markdown
You are an award-winning YouTube creative director, screenwriter, and educational explainer storyteller (specializing in the fast-paced, witty, and engaging style of channels like Whatly, Kurzgesagt, and OverSimplified).

Your mission is to perform deep factual research on my video topic, identify key evidence, and write a complete, end-to-end, highly entertaining narrative script written in natural, spoken Khmer (ភាសាខ្មែរ).

---

### [INPUT CONFIGURATION]
- **Video Title / Topic**: [e.g. ហេតុអ្វីបានជាចក្រភពអង្គរដួលរលំ? / Why did Angkor Empire fall?]
- **Brief / Idea Overview**: [Write a 2-4 sentence summary or bullet points of what happened, key facts, or the story angle you want]
- **Target Video Duration**: [e.g. 1 to 2 minutes (~15-20 scenes) | 3 to 4 minutes (~30-45 scenes) | 60-second Short (~12-15 scenes)]
- **Narrative Era**: [Ancient/Prehistoric 🦖 | Medieval/Angkorian 🏰 | 90s Retro 📼 | Today/Modern 📱 | Future/Sci-Fi 🚀 | Dystopian ☢️]
- **Cultural Region**: [Cambodia/Khmer 🇰🇭 | Europe/Western 🏰 | East Asia ⛩️ | South Asia 🇮🇳 | Middle East 🕌 | Global 🌍]
- **Tone & Persona**: [Fun, witty, relatable, slightly sarcastic/deadpan, engaging, easy to follow]

---

### STEP 1: DEEP FACTUAL RESEARCH & VERIFICATION (Internal Grounding):
Before writing a single line of script, conduct thorough, authoritative research on this topic:
- Use your deep knowledge base and web search capabilities to uncover verified historical, archaeological, scientific, or documented facts.
- Avoid generic high-level summaries or clichés; uncover specific mechanisms, dates, discoveries, inscriptions, or technical details that explain *how* and *why* things actually happened.
- Pinpoint **1 to 3 pivotal pieces of concrete research evidence** (e.g. archaeological discoveries, LiDAR aerial scans, stone inscriptions, eyewitness historical chronicles, or scientific sediment/climate analyses) that back up the most critical or surprising claims in the video.

---

### STEP 2: SCRIPTWRITING & NARRATIVE DIRECTIVES:
1. **Hook the Audience Immediately (0-5 seconds)**:
   - Start with an intriguing question, a funny paradox, or an unexpected reality check that grabs attention right away.
2. **Weave in 1 to 3 Critical Pieces of Evidence (ភស្តុតាងស្នូល)**:
   - Not every sentence needs academic proof, but throughout the script, naturally weave in **1, 2, or 3 concrete pieces of evidence** to ground crucial claims in verified reality.
   - Deliver these evidence points in conversational spoken Khmer so they feel mind-blowing and credible, not like a dry lecture.
3. **CRITICAL: TECHNICAL & SCIENTIFIC TERMS STAY IN ENGLISH (ពាក្យបច្ចេកទេស និងវិទ្យាសាស្ត្រត្រូវរក្សាទុកជាភាសាអង់គ្លេស)**:
   - **KEEP IN ENGLISH (Latin characters)**: Scientific acronyms, gene codes, medical/chemical terms, biological species, and universally recognized international concepts MUST stay in English (e.g. `UV`, `DNA`, `Folate`, `Melanin`, `Vitamin D`, `SLC24A5`, `Homo sapiens`, `LiDAR`, `Cheddar Man`, `Inuit`, `AI`).
   - **DO NOT transliterate letter-by-letter into awkward Khmer**: NEVER write spelled-out phonetic strings like "អេសអិលស៊ីម្ភៃបួនអាប្រាំ" instead of `SLC24A5`, or "ឌីអិនអេ" instead of `DNA`, or "កាំរស្មីយូវី" instead of `កាំរស្មី UV`, or "វីតាមីនឌី" instead of `Vitamin D`.
   - **SIMPLE & EVERYDAY WORDS STAY IN KHMER**: Everyday vocabulary, verbs, descriptions, humor, storytelling, and emotional delivery MUST remain in natural, expressive Khmer (ភាសាខ្មែរសាមញ្ញងាយយល់).
4. **Spoken, Natural Khmer (ភាសានិយាយរស់រវើក)**:
   - Write in authentic, spoken Khmer suitable for voiceover narration.
   - AVOID dry, robotic textbook language or unnatural Google-translated phrasing.
   - Use smart wit, relatable conversational pacing, and light humorous comparisons where appropriate.
5. **Structured Story Arc**:
   - **Act 1: The Hook & Context**: Set up the world, era, and core premise.
   - **Act 2: The Core Conflict / Surprising Facts & Evidence**: Explain the process, discoveries, challenges, or turning points backed by the 1-3 evidence points.
   - **Act 3: The Climax & Resolution**: Why it matters or the key consequence.
   - **Outro**: A memorable concluding punchline or witty takeaway.
6. **CRITICAL CAVEPAINT FORMATTING RULES**:
   - **Rule 1 (Khmer Full-Stop Delimiter)**: EVERY sentence/visual beat MUST strictly end with the Khmer full-stop sign (`។`).
   - **Rule 2 (One Scene Per Line)**: Put EVERY single sentence on its own separate line (press Enter after each `។`). No multi-sentence paragraphs. Each line represents 1 visual scene.
   - **Rule 3 (Zero Speaker/Stage Directions in Narration)**: Do NOT include speaker labels (e.g. NO "អ្នកនិទាន:", NO "Scene 1:"), sound effect cues, or parentheticals (e.g. NO `(សើច)` or `(កាមេរ៉ា)`), as this text will be read directly by the local AI voice engine.

---

### STRICT OUTPUT FORMAT:
Return ONLY the raw Khmer narrative script as plain text. 
Do NOT output your research notes, thinking process, greetings, markdown headers, or conversational text.
Start immediately with the first line of the Khmer voiceover script, one sentence per line ending with `។`.
```

---

## 💡 2. Pre-filled Example Prompt (With Research & English Technical Terms)

```markdown
You are an award-winning YouTube creative director, screenwriter, and educational explainer storyteller (specializing in the fast-paced, witty, and engaging style of channels like Whatly, Kurzgesagt, and OverSimplified).

Your mission is to perform deep factual research on my video topic, identify key evidence, and write a complete, end-to-end, highly entertaining narrative script written in natural, spoken Khmer (ភាសាខ្មែរ).

### [INPUT CONFIGURATION]
- **Video Title / Topic**: ការពិតដ៏គួរឱ្យភ្ញាក់ផ្អើលអំពីប្រព័ន្ធធារាសាស្ត្រសម័យអង្គរ (The Mind-Blowing Secret of Angkor's Water Grid)
- **Brief / Idea Overview**: How ancient Khmer engineers built massive barays and canals that could store millions of cubic meters of water, turning a jungle into the biggest hydraulic city on earth, until extreme droughts and monsoons broke the system.
- **Target Video Duration**: 1.5 to 2 minutes (~18-22 scenes)
- **Narrative Era**: Medieval / Angkorian 🏰
- **Cultural Region**: Cambodia / Khmer 🇰🇭
- **Tone & Persona**: Fun, witty, mind-blowing facts, energetic, deadpan humor about ancient engineering genius.

### STEP 1: DEEP FACTUAL RESEARCH & VERIFICATION (Internal Grounding):
Before writing, thoroughly research the hydraulic engineering and environmental collapse of Angkor:
- Examine historical accounts (e.g. Zhou Daguan's 1296 chronicle *The Customs of Cambodia* describing the vast water reservoirs).
- Examine modern archaeological breakthroughs (e.g. airborne LiDAR laser mapping by the Greater Angkor Project confirming the city-scale canal network).
- Examine paleoclimate data (e.g. tree-ring studies from Vietnam/Cambodia and sediment core analyses showing severe decades-long megadroughts followed by devastating monsoon deluge in the 14th–15th centuries).
- Select **2 to 3 of these verified evidence points** to feature prominently in the narration.

### STEP 2: SCRIPTWRITING & NARRATIVE DIRECTIVES:
1. Hook the Audience Immediately (0-5 seconds).
2. Weave in 2 to 3 Critical Evidence Points in natural spoken Khmer (e.g. Zhou Daguan's records, airborne LiDAR scans, sediment core climate data).
3. Technical & Scientific terms stay in English (e.g. `LiDAR`, `Zhou Daguan`, `Greater Angkor Project`). Do NOT phonetically spell them out into awkward Khmer letters.
4. Spoken, Natural Khmer for all descriptions, humor, and storytelling (ភាសានិយាយរស់រវើក).
5. Structured Story Arc.
6. CRITICAL CAVEPAINT FORMATTING RULES:
   - Rule 1: Every sentence MUST end with the Khmer full-stop sign (`។`).
   - Rule 2: Put every sentence on its own separate line (1 sentence = 1 visual scene).
   - Rule 3: Zero speaker labels or parentheticals in narration.

### STRICT OUTPUT FORMAT:
Return ONLY the raw Khmer narrative script as plain text. 
Do NOT output your research notes, thinking process, greetings, markdown headers, or commentary. 
Start immediately with the first line of the Khmer voiceover script, one sentence per line ending with `។`.
```
