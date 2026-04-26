# FNOL (First Notice of Loss) Workflow Guide for DialogLab

This guide structures the insurance claim intake conversation between Alice (Claims Adjuster) and Bob (Elderly Claimant) into organized scenes and conversation nodes.

---

## Recommended Scene Structure

Create multiple conversation nodes (scenes) following this sequence:

### Scene 1: Initial Contact & Safety Check
**Title:** "Initial Report and Emergency Assessment"

**Context:**
Bob is calling to report an accident. Alice answers and immediately assesses if there are safety/medical emergencies.

**Key Questions Alice Should Ask:**
- Is anyone injured?
- Are all parties safe from traffic hazards?
- Do you need emergency services?
- Are there any hazardous material spills?

**Information to Capture:**
- Current status of all parties
- Whether emergency services were called
- Current location safety status

**Dialogue Notes:**
- Alice should: Express concern, be calm, prioritize safety
- Bob should: Report stress level, explain immediate situation

---

### Scene 2: Policy & Policyholder Verification
**Title:** "Policy Information and Contact Details"

**Context:**
Once safety is confirmed, Alice verifies the policy and gets Bob's full contact information.

**Key Questions Alice Should Ask:**
- What is your policy number? (or license plate / VIN)
- Are you the policyholder?
- Can you confirm your full name and date of birth?
- What is your telephone number?
- What is your email address?
- How would you prefer we contact you (phone, email, mail)?

**Information to Capture:**
- [ ] Policy number
- [ ] Policyholder name and DOB
- [ ] Current contact: phone, email, address
- [ ] Preferred communication channel

**Additional Checks:**
- Verify policy is active and in-force on date of loss
- Check if premium is current (no arrears)
- Confirm vehicle and driver are on policy

---

### Scene 3: Reporter Type & Relationship
**Title:** "Who Is Reporting This Claim?"

**Context:**
Establish who is making the report and their relationship to the incident. This affects the downstream investigation flow.

**Key Questions Alice Should Ask:**
- Are you the driver of the vehicle?
- If not you driving: Who was driving? (name, age, driver license info)
- What is your relationship to the driver?
- Is the driver a household member?

**Information to Capture:**
- Reporter type: ☐ Policyholder ☐ Driver ☐ Other (specify)
- If not driver: Driver's full name, DOB, relationship
- Driver license number and expiry
- Is driver listed on policy? Check driver scope

**Red Flags to Note:**
- If not the policyholder or named driver calling
- If driver is underage restriction on policy
- If driver recently added to policy

---

### Scene 4: Accident Date, Time & Location
**Title:** "When and Where Did the Accident Happen?"

**Context:**
Establish the precise timeline and location of the loss.

**Key Questions Alice Should Ask:**
- What is the exact date of the accident?
- What time did it happen? (as precise as possible)
- What time are you reporting it now? (delay matters for duty-of-disclosure)
- What is the full address/location of the accident?
- What country/city?
- What type of road? (highway, urban, rural, parking lot)
- What were the weather conditions?
- What was the visibility like?
- What were the road conditions? (dry, wet, icy, gravel, etc.)

**Information to Capture:**
- [ ] Date of loss: __ / __ / ____
- [ ] Time of loss: __:__ (AM/PM)
- [ ] Time of report: __:__ (AM/PM) — **Note delay**
- [ ] Full address and GPS coordinates if available
- [ ] Country and region
- [ ] Road type: ☐ Highway ☐ Urban ☐ Rural ☐ Parking ☐ Other
- [ ] Weather: ☐ Clear ☐ Rain ☐ Snow ☐ Fog ☐ Other
- [ ] Visibility: ☐ Good ☐ Reduced ☐ Poor
- [ ] Road condition: ☐ Dry ☐ Wet ☐ Icy ☐ Gravel ☐ Other

**Red Flags:**
- Significant delay between accident and report (>7 days may trigger duty-of-disclosure review)
- Accident in geographic area outside policy coverage

---

### Scene 5: Type of Loss & What Happened
**Title:** "What Type of Accident Was It?"

**Context:**
Classify the loss and get Bob's account of how the accident happened in his own words.

**Key Questions Alice Should Ask:**
- What type of loss? (collision, parking damage, animal strike, etc.)
- In your own words, what happened? Please describe the sequence of events.
- Where were you traveling? (direction)
- What speed were you traveling at (estimate)?
- Was there another vehicle involved?
- If yes: Did the other vehicle hit you, or did you hit it?
- Who had right-of-way?
- Any traffic signals or signs involved?
- Did anyone admit fault at the scene?
- Do you have photos or a sketch of the damage?

**Information to Capture:**
- [ ] Type of loss:
  - ☐ Moving traffic collision (2+ vehicles)
  - ☐ Stationary vehicle collision (hit parked car)
  - ☐ Parking lot collision
  - ☐ Wildlife/animal strike
  - ☐ Property damage (guardrail, fence, signage, building)
  - ☐ Other: __________
- [ ] Free-form narrative (Bob's account in his own words)
- [ ] Direction of travel
- [ ] Estimated speed
- [ ] Right-of-way situation
- [ ] Traffic signals/signs involved
- [ ] Fault admission at scene (yes/no, by whom)
- [ ] Photos available? ☐ Yes ☐ No
- [ ] Sketch available? ☐ Yes ☐ No

**Liability Signal Checkpoints:**
- Rear-end collision? (usually liable)
- Lane change involved?
- Reversing involved?
- Right-of-way violation?
- Red light/stop sign run?
- Following distance violation?

**Bob's Perspective:**
- Bob may struggle to recall exact speeds — accept estimates
- Bob may describe events out of chronological order — gently clarify sequence
- Reassure Bob that details are being documented

---

### Scene 6: Driver Details & Coverage Scope
**Title:** "Driver License and Coverage Check"

**Context:**
Verify that the driver was legally entitled to drive and falls within the policy's driver scope.

**Key Questions Alice Should Ask:**
- Do you have a valid driver's license?
- What is your license number and expiry date?
- What class is your license? (B, C1, etc.)
- How long have you held your license?
- Were you under the influence of alcohol or drugs at the time?
- Did you take a breathalyzer test?
- Any medication that might affect driving?
- Any health conditions that affect your ability to drive?

**Information to Capture:**
- [ ] License number: __________
- [ ] License expiry: __ / __ / ____
- [ ] License class: __________
- [ ] Held since: __ / __ / ____
- [ ] Valid at time of loss? ☐ Yes ☐ No ☐ Expired
- [ ] Alcohol/drugs involved? ☐ No ☐ Yes (specify)
- [ ] Breathalyzer test? ☐ Not done ☐ Negative ☐ Positive
- [ ] Medications that might affect driving? ☐ No ☐ Yes (list)
- [ ] Health limitations? ☐ No ☐ Yes (describe)

**Policy Scope Verification:**
- Check: Is this driver listed on the policy?
- Check: Is there an age restriction on the policy?
- Check: If occasional driver, is surcharge applied?
- Check: Any exclusions for this driver?

**Red Flags:**
- License expired on date of loss
- Driver under minimum age for driving class
- Alcohol/drug involvement
- Hit-and-run situation (immediately triggers investigation)
- DUI or criminal charges pending

---

### Scene 7: Other Party / Third Party Details
**Title:** "Information About the Other Vehicle/Party"

**Context:**
If this was a collision with another vehicle or party property, gather their identification and insurance details.

**Key Questions Alice Should Ask:**
- Was anyone else involved?
- Can you provide the other driver's name and contact?
- Do you have their vehicle registration?
- License plate and VIN of their vehicle?
- Make, model, and color of their vehicle?
- Do you have their insurance information?
- What is their insurance company and policy number?
- Is the registered owner the same as the driver?
- Did the other party admit fault?
- Have they already contacted their insurer?
- Have they sent a letter or lawyer involved?

**Information to Capture:**
- [ ] Other party name: __________
- [ ] Phone: __________
- [ ] Email: __________
- [ ] Address: __________
- [ ] License plate: __________
- [ ] VIN: __________
- [ ] Vehicle make/model/color: __________
- [ ] Insurance company: __________
- [ ] Policy number: __________
- [ ] Is owner same as driver? ☐ Yes ☐ No
- [ ] Other party admits fault? ☐ Unknown ☐ Yes ☐ No
- [ ] Letter received? ☐ No ☐ Yes (date: __)
- [ ] Lawyer involved? ☐ No ☐ Yes (name/firm: __)
- [ ] Already claimed with their insurer? ☐ No ☐ Yes

**Recourse Indicators:**
- Confirmed other-party insurer = potential for direct recourse
- Other party's liability clear = direct settlement opportunity

---

### Scene 8: Police Report & Authorities
**Title:** "Police Report and Authorities"

**Context:**
Determine if police were involved and gather reference information.

**Key Questions Alice Should Ask:**
- Was the police called to the scene?
- Did police attend?
- What police station/department?
- Do you have a police report number or reference?
- When can you obtain a copy of the police report?
- Are there any fines issued?
- Are any criminal charges possible?

**Information to Capture:**
- [ ] Police attended? ☐ Yes ☐ No
- [ ] Police station: __________
- [ ] Report number: __________
- [ ] Reference: __________
- [ ] Fines issued? ☐ No ☐ Yes (amount: __, cite: __)
- [ ] Criminal charges? ☐ No ☐ Pending ☐ Filed (charges: __)
- [ ] Administrative offense? ☐ No ☐ Yes (type: __)
- [ ] Report available for claim file? ☐ No ☐ Yes (when: __)

**Flag for Investigation:**
- If criminal charges or hit-and-run: Immediate SIU referral
- If dangerous driving charges: Coverage issue possible

---

### Scene 9: Witnesses
**Title:** "Witnesses and Passengers"

**Context:**
Identify any independent witnesses who saw the accident.

**Key Questions Alice Should Ask:**
- Were there any independent witnesses?
- Did anyone stop to help?
- What are their names and contact information?
- Were there passengers in your vehicle?
- What are their names and contact information?
- Any passengers in the other vehicle?

**Information to Capture:**

**Independent Witnesses:**
- Witness 1: Name __________, Phone: __________, Brief statement: __________
- Witness 2: Name __________, Phone: __________, Brief statement: __________
- Witness 3: (additional as needed)

**Passengers - Your Vehicle:**
- Passenger 1: Name __________, Relation: __________, Phone: __________
- Passenger 2: Name __________, Relation: __________, Phone: __________

**Passengers - Other Vehicle:**
- Name: __________, Phone: __________, Any injuries? ☐ Yes ☐ No

**Investigation Note:**
- Independent (non-party) witnesses are highly valuable
- Collect statements if possible before memories fade

---

### Scene 10: Injuries & Medical
**Title:** "Injuries and Medical Treatment"

**Context:**
Determine if there are any personal injuries requiring medical attention.

**Key Questions Alice Should Ask:**
- Is anyone injured?
- Yourself?
- Passengers?
- Other party?
- Anyone else (pedestrians, cyclists)?
- What type of injuries? (describe)
- Did anyone receive treatment?
- Hospital or outpatient care?
- Doctor or hospital name?
- Any anticipated time off work?
- Health insurance carrier for injured parties?

**Information to Capture:**
- [ ] Injuries? ☐ No ☐ Yes

**If Yes - Injured Parties:**
- Party 1: __________ | Relation: __________ | Injury: __________
- Party 2: __________ | Relation: __________ | Injury: __________

**Treatment Received:**
- [ ] No treatment
- [ ] Outpatient (clinic/doctor) - Where: __________, When: __________
- [ ] Inpatient (hospital) - Hospital: __________, Duration: __________

**Health Insurance for Injured:**
- Injured party: __________ | Health insurer: __________

**Time Off Work:**
- Anticipated? ☐ No ☐ Yes | Duration: __________

**Medical Investigation Notes:**
- Consider formal medical assessment if significant injuries
- Coordinate with health insurer for subrogation (if applicable in jurisdiction)

---

### Scene 11: Property Damage Assessment
**Title:** "Vehicle Damage and Condition"

**Context:**
Assess the damage to Bob's vehicle and determine repairability and current location.

**Key Questions Alice Should Ask:**
- Can you describe the damage to your vehicle?
- Where is the damage located? (front, rear, side, etc.)
- Can the vehicle be driven?
- Where is the vehicle currently?
- Was it towed? By whom and to where?
- Do you have damage photos?
- Has any prior damage to this area that wasn't repaired?

**Information to Capture:**
- [ ] Damage location: ☐ Front ☐ Rear ☐ Left side ☐ Right side ☐ Top ☐ Interior ☐ Multiple
- [ ] Damage description: __________
- [ ] Drivable? ☐ Yes ☐ No
- [ ] Current location: __________
- [ ] Was vehicle towed? ☐ No ☐ Yes
- [ ] Tow company: __________ | Location towed to: __________
- [ ] Photos available? ☐ No ☐ Yes (how many: __)
- [ ] Prior damage in area? ☐ No ☐ Yes (pre-existing)

**Third-Party Property:**
- [ ] Damage to other vehicle? ☐ No ☐ Yes (describe: __)
- [ ] Damage to property? (guardrail, fence, sign, building) ☐ No ☐ Yes
  - Owner: __________ | Estimated damage: __________

---

### Scene 12: Coverage Scope & Exclusions Check
**Title:** "Coverage Verification and Policy Exclusions"

**Context:**
Verify coverage applies and identify any potential exclusions.

**Key Questions Alice Should Ask:**
- Was the vehicle being used for private personal driving?
- Any commercial use (rideshare, delivery)?
- Any paid passenger transport?
- Was the vehicle modified in any way?
- Are emissions tests current?
- Vehicle registration current?
- Any seasonal plate restrictions?
- Racing or track events involved?

**Information to Capture:**
- [ ] Use outside scope? ☐ No ☐ Yes (describe: __)
- [ ] Commercial use? ☐ No ☐ Yes
- [ ] Paid passengers? ☐ No ☐ Yes
- [ ] Vehicle modifications? ☐ No ☐ Yes (what: __)
- [ ] Emissions test (HU/AU) current? ☐ Yes ☐ No ☐ Unknown
- [ ] Vehicle registration current? ☐ Yes ☐ No
- [ ] Seasonal plate restrictions? ☐ No applicable ☐ Yes (windows: __)
- [ ] Racing/track event? ☐ No ☐ Yes

**Exclusion Red Flags:**
- Out-of-scope use = coverage denial likely
- Gross negligence clauses if reckless driving
- Telematics conditions if device was supposed active
- Geographic restrictions if loss outside coverage area

---

### Scene 13: Fraud Signal Assessment
**Title:** "Routine Verification Questions"

**Context:**
Ask routine questions that help screen for fraud (not accusatory).

**Key Questions Alice Should Ask:**
- When exactly did you first notice the damage?
- When did you report it to us?
- Do you know the other party involved?
- Are you related to the other party?
- Have you had any similar claims in the last 24 months?
- Is your vehicle currently for sale?
- Any recent owner or major buyer/seller activity?

**Information to Capture:**
- [ ] Damage noticed: Date __ / __ / ____, Time __:__
- [ ] Reported to us: Date __ / __ / ____, Time __:__
- [ ] Known party? ☐ No ☐ Yes (relationship: __)
- [ ] Related to party? ☐ No ☐ Yes (relationship: __)
- [ ] Similar claims last 24 months? ☐ No ☐ Yes (number: __)
- [ ] Vehicle for sale? ☐ No ☐ Yes (listing date: __)
- [ ] Recent transfer? ☐ No ☐ Yes (date: __)

**Fraud Indicators (flag for SIU review if multiple present):**
- Significant delay before reporting
- Parties known to each other
- Multiple similar claims
- Vehicle listed for sale around loss date
- Damage seems disproportionate to accident description

---

### Scene 14: Settlement Preferences & Next Steps
**Title:** "Immediate Needs and Next Steps"

**Context:**
Understand Bob's immediate needs and set clear expectations for claim handling.

**Key Questions Alice Should Ask:**
- Do you need a rental vehicle while yours is repaired?
- Do you have a preferred repair shop?
- Any questions about your coverage?
- What is the best way to reach you?
- Can you provide photos/documents?
- When is a good time to follow up?

**Information to Capture:**
- [ ] Rental car needed? ☐ No ☐ Yes
- [ ] Preferred repair shop? ☐ No ☐ Yes (name: __)
- [ ] Lawyer involved? ☐ No ☐ Yes (name/firm: __)
- [ ] Preferred contact method: ☐ Phone ☐ Email ☐ Mail
- [ ] Best phone number: __________
- [ ] Best email: __________
- [ ] Best time to contact: __________
- [ ] Can provide photos? ☐ No ☐ Yes (when: __)
- [ ] Can provide statement? ☐ No ☐ Yes (when: __)
- [ ] European Accident Statement? ☐ Not applicable ☐ Has it ☐ Can get from other party

**Next Steps to Communicate:**
- "Here's what happens next: ..."
- Estimated timeline for claim decision
- Who will be handling the claim
- How they will be updated
- What documents/information is needed

---

## Summary: Question Priority Tiers

### Tier 1 - **Mandatory (Must Have)**
Must collect before claim can be processed:
1. Policy number (or VIN/license plate)
2. Claimant name and contact
3. Date and location of loss
4. Type of loss
5. Who was driving
6. Other party details (if applicable)
7. Police report info (if obtained)

### Tier 2 - **Critical (Should Have)**
Needed for coverage determination:
1. Driver license status
2. Is driver in policy scope?
3. Weather/road conditions
4. Accident narration (how it happened)
5. Injuries (if any)
6. Damage scope
7. Coverage exclusion screening

### Tier 3 - **Important (Nice to Have)**
Valuable for investigation:
1. Witness information
2. Photos
3. Police report
4. Prior damage
5. Fraud signal check

---

## Conversation Flow Tips for Alice

**Empathy-First Approach:**
- Start each conversation acknowledging Bob's stress
- Use reassuring tone
- Don't rush through information gathering
- Summarize details back to Bob for confirmation

**Question Sequencing:**
1. Start with immediate safety/emergencies
2. Move to identity/policy verification (builds trust)
3. Then gather accident facts (what, when, where)
4. Include third-party details (other vehicle)
5. Check coverage scope
6. Discuss immediate needs (rental, repair authorization)
7. Explain next steps clearly

**Handling Bob's Imperfect Recall:**
- "That's okay if you don't remember exactly..."
- Accept approximations (speeds, times)
- Ask clarifying follow-up questions gently
- Confirm details before moving on
- Don't challenge Bob's account unless red flags present

**Plain Language Rule:**
- Never use: "Vollkasko", "Kasko", "Fahrerkreis", "Obliegenheit"
- Instead say: "comprehensive coverage", "driver scope", "your responsibilities"
- Always explain insurance terms in simple language

---

## Creating Multiple Scenes in DialogLab

To structure this FNOL workflow across multiple conversation nodes in DialogLab:

1. **Create separate Scene nodes** for each major topic area (14 scenes recommended)
2. **Connect scenes** in a logical sequence
3. **Set conversation parameters:**
   - Alice as Insurer (use updated template)
   - Bob as Claimant (use updated template)
   - Each scene focuses on one topic area
   - Alice asks questions from the checklist
   - Bob responds with details of his accident

4. **Use Node Inspector** to:
   - Set `interactionPattern: "supportive"` (Alice) vs `"receptive"` (Bob)
   - Set `turns: 4-6` per scene (enough for Q&A exchange)
   - Set `derailerMode: false` (keep on-topic for FNOL workflow)

5. **Scene branching** based on responses:
   - If multi-vehicle collision → include Scene 7 (Other Party Details)
   - If injuries reported → include Scene 10 (Medical)
   - If police involved → include Scene 8 (Police)
   - If no injuries/police → skip those scenes

---

## Policy Document Data to Reference

Alice should mentally reference (or have access to in real system):
- [ ] Policy effective date
- [ ] Coverage type (Vollkasko/Teilkasko/Haftpflicht)
- [ ] Deductible amounts
- [ ] Included drivers
- [ ] Age restrictions
- [ ] Vehicle details on file
- [ ] Geographic coverage area
- [ ] Any active policy exclusions or endorsements

---

This workflow ensures comprehensive FNOL intake while maintaining empathy, clear communication, and systematic information gathering.
