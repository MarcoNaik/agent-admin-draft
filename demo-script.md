# Struere Demo Script (~90s)

## HOOK (5s)

*Screen: Claude Code terminal, empty project*

> Sara runs a dental clinic in Sydney. Her receptionist misses 30 calls a day. She's losing $12,000 a month.

## PROMPT 1 — Create the agent (10s)

*Screen: User types into Claude Code: "Build me a receptionist agent for a dental clinic. It handles cleanings, whitening, and emergencies."*

> We tell Claude Code what we need. Claude uses Struere to scaffold the agent, configure the prompt, and set the model. No dashboard. No drag and drop.

## PROMPT 2 — Create the database (10s)

*Screen: User types: "Add an appointment data type with patient name, service, date, and status."*

> Claude creates the database schema and wires it to the agent. Four fields. The agent can now read and write appointments.

## PROMPT 3 — Test it (15s)

*Screen: User types: "Run the agent in studio." Chat opens. A message comes in: "I need a cleaning Thursday."*

> We test it. A patient asks for Thursday. The agent finds 2 PM open, books it, saves the record. One turn.

## PROMPT 4 — Create and run evals (12s)

*Screen: User types: "Write 20 eval scenarios for edge cases — double bookings, cancellations, public holidays, after-hours." Then: "Run the evals."*

> Claude writes 20 tests and runs them. 19 pass. The agent booked over Australia Day. Claude fixes the prompt, reruns. 20 out of 20.

## PROMPT 5 — Build an automation (10s)

*Screen: User types: "When an appointment is created, send the patient a WhatsApp confirmation with the date, time, and clinic address."*

> Claude adds the trigger. One sentence turned into a working automation.

## PROMPT 6 — Deploy (12s)

*Screen: User types: "Deploy to production." CLI runs `struere deploy`. WhatsApp notification pops up.*

> We deploy. That night at 11 PM, a patient asks about an emergency filling. The agent books her for 8 AM. Sara sees it in the morning.

## CLOSE (8s)

> Six prompts. No developer. A receptionist running 24 hours on WhatsApp, built in a conversation.

## END CARD

> struere.dev
