// ============================================================
//  BIO BUDDY SETTINGS
//  Edit anything between the quotation marks. Don't delete
//  the quotation marks, commas, or brackets.
// ============================================================

const BOT_CONFIG = {
  // The bot's name and emoji (shown at the top of the page)
  name: "Bio Buddy",
  emoji: "🧬",

  // Small line under the name
  tagline: "Your friendly study partner for first-year bio",

  // The first message the bot shows when a chat starts
  welcomeMessage: "Hi! I'm Bio Buddy, what can I help you with today?",

  // The bot's rules. This is sent to the AI with every message.
  // TODO: replace this with your final system instructions from Lesson 1.
  systemInstruction: `You are Bio Buddy, a study assistant for first-year college biology students.
Your one job is to help students understand and remember biology material as well as possible.

Tone: friendly, encouraging, informational, and easy to read.

How to answer:
- Explain concepts in plain language first, then add the technical terms.
- Keep answers short and organized. Use short paragraphs and bullet points.
- Use memory tricks such as mnemonics, analogies, and simple examples when they help.
- When useful, end with one quick question to check the student's understanding.
- If a student seems confused, try a different explanation instead of repeating yourself.
- If you are not sure about something, say so, and suggest checking their textbook or professor.
- Stay on biology and study skills. Politely steer off-topic questions back to biology.
- Do not just give answers to graded assignments. Help the student learn how to get there.`,

  // Buttons shown under the chat before the first message
  starterQuestions: [
    "Can you explain the difference between mitosis and meiosis?",
    "How can I remember the steps of cellular respiration?",
    "Quiz me on DNA replication!"
  ],

  // Which Gemini model to use
  model: "gemini-flash-latest",

  // Main color (hex code)
  themeColor: "#BA0C2F"
};
# BIOL 1107 Fall 2026 knowledge file
Anything above the first ## line is ignored. Source: the BIOL 1107 Fall 2026 syllabus.

## When and where does BIOL 1107 meet?
BIOL 1107, Principles of Biology, is the Fall 2026 course, section 10202. It meets in person on Monday, Wednesday, and Friday from 12:00pm to 12:55pm. The class room is Science Learning Center Room 0085. Attendance and participation are mandatory in this course. In class, students take part through polling questions and group worksheets.

## Office hours and how to contact the instructor or TAs
The instructor holds office hours on Mondays and Wednesdays 10:00am-11:30pm in the office (Cedar Street Building C, room 275a) or by Zoom. For a Zoom appointment, email the instructor. The course also has one graduate TA and three undergraduate TAs. If you encounter a barrier to completing assignments on time, contact the instructor as soon as possible to discuss possible solutions.

## Do I need to take the BIOL 1107L lab?
Participation in this course requires enrollment in the corequisite lab, BIOL 1107L, unless the lab has already been completed. BIOL 1107L is the lab that goes with BIOL 1107. Lecture and lab are linked in Athena, but the two courses are independent. For questions about lab enrollment, visit the Biology Advising Office in Barrow Hall or email biology@uga.edu.

## What topics does the course cover?
The course focuses on the storage and flow of genetic information in biological systems. It examines how genetic information influences organismal traits, how information is passed to the next generation, and how genetic information and populations change over time (evolve). Students should be able to describe and apply: genes, alleles, genetic crosses, and patterns of inheritance; eukaryotic chromosomes in mitosis and meiosis and how chromosome behavior corresponds to genetic inheritance; key aspects of DNA replication, transcription, and translation; the phenotypic consequences of different kinds of mutations; how to predict the genetic structure of populations; the mechanisms that cause populations to evolve; and phylogenetic trees and the evolutionary relationships between species.

## Textbook, Codon Learning, and cost
There is no textbook for this course. Instructional materials such as slides and worksheets are posted on Codon Learning during the semester. Codon also has pre-class reading questions, in-class questions and worksheets, weekly homework, a study path, and a practice test. Students need a device that connects to the internet. A Codon license costs $40 for UGA students and lasts four years. Students get access to Codon through eLC.

## How is my grade calculated? Grade percentages
Learning and course engagement are evaluated by three parts. Codon assignments are 25% of the grade. In-class activities are 15%. Unit exams are 60%. Codon assignments include the Readiness Readings, weekly Homework, and the exam-preparation study path and practice test. In-class activities are group worksheets and Codon polling questions. Unit exams include multiple choice, true/false, and one free response question. Grades are posted in eLC throughout the semester.

## Codon assignment due dates, late work, and dropped assignments
Readiness Readings are pre-class work due at 8:00am before class. Homework comes about once a week and is due by 8:00am on Monday. The Codon study path and practice test are due by midnight the night before each exam. Deadlines are listed in Codon, and assignments are open for about one week before the deadline (not counting in-class questions). Codon assignments can be turned in 24 hours late with a 25% grade penalty. Late work beyond these extensions is not accepted. The lowest 3 Codon assignments are dropped.

## In-class participation, group worksheets, and dropped scores
Polling participation: in class there are clicker-style questions using Codon. Students earn points for answering them, and they are not scored for correctness. Group worksheets: students form a permanent in-class group that they work with all semester. Worksheets are not assessed for correctness but for good-faith effort and completion. The lowest 3 in-class worksheet scores and the lowest 3 in-class Codon scores, including zeros for non-attendance, are dropped. Students do not need to contact the instructor each time they miss a class. Trying to get credit for group worksheets without attending class results in a score of zero for all affected activities.

## Unit exams: format, location, and makeup rules
There are five exams in this course. They combine true/false, multiple-choice, and one free response question. Four exams are given during normal class times (1:15 – 2:10 pm) in Science Learning Center Room 0285. The final exam is Monday, Dec. 7 at 12:00 pm, location to be determined. Each exam covers the material from the previous unit and is not comprehensive, including the final. No exams are dropped. To take an exam at a different time because of significant hardship or a UGA-sanctioned event, contact the instructor one week in advance. For illnesses, get documentation and contact the instructor as soon as possible.

## Course schedule and exam dates
Aug 17 to Sep 4: Introduction and the Central Dogma of Biology. Unit 1 exam: Sep 9. Sep 11 to Sep 25: DNA replication, cell cycle, and mitosis. Unit 2 exam: Sep 28. Sep 30 to Oct 12: Sex, meiosis, and life cycles. Unit 3 exam: Oct 14. Oct 16 to Nov 2: Inheritance. Unit 4 exam: Nov 4. Nov 6 to Nov 30: Evolution. Unit 5 exam: on the final exam date, Monday Dec 7 at 12:00 pm. The syllabus is a general plan, and significant changes are announced in class and posted on eLC.

## Letter grade scale
Students get a letter grade at the end of the semester. A is 93% (92.50–100.0). A– is 90% (89.50–92.49). B+ is 87% (86.50–89.49). B is 83% (82.50–86.49). B– is 80% (79.50–82.49). C+ is 77% (76.50–79.49). C is 70% (69.50–76.49). D is 60% (59.50–69.49). Thresholds for some or all letter grades can be decreased at the discretion of the instructor.

## Academic honesty, cheating, and plagiarism
Students must follow the UGA Student Honor Code: "I will be academically honest in all of my academic work and will not tolerate academic dishonesty of others." Plagiarism and cheating are serious academic offenses, and suspected cases follow UGA's Academic Honesty Policy, found at honesty.uga.edu. Working together on outside-of-class assignments and studying for exams is encouraged. So are campus resources like the Office of Student Success & Achievement and the Writing Center. Students with questions about how they may complete assignments should ask.

## Can I use ChatGPT or other AI tools?
Generally, there is little opportunity or reason to use AI in this course. Use of generative AI (GAI) tools is prohibited without prior approval from the instructor. This includes all stages of the work process, even preliminary ones. The prohibition covers tools like ChatGPT, Copilot, Writesonic, Rytr, and Rtutor. A student who is uncertain about using a particular tool should consult the instructor before using it.

## Disability accommodations
Reasonable accommodations are available for students with documented disabilities when approved. To apply or learn more, contact Accessibility and Testing at (706) 542-8719 or accessibility.uga.edu. Inquiries are confidential. Students should contact Accessibility and Testing as soon as possible so accommodations are met throughout the course. The Disability Resource Center and Testing Services is also listed at drc.uga.edu.

## Well-being and mental health support at UGA
UGA Well-being Resources support student success and a healthy student community. Anyone needing assistance can contact Student Care & Outreach at 706-542-8479 or sco.uga.edu. It connects students with the most appropriate resources and runs the Embark@UGA program, which supports students experiencing, or who have experienced, homelessness, foster care, or housing insecurity. Other resources: well-being.uga.edu, the University Health Center (healthcenter.uga.edu), Counseling and Psychiatric Services (caps.uga.edu, with CAPS 24/7 crisis support at 706-542-2273), and Health Promotion/Fontaine Center (healthpromotion.uga.edu).
