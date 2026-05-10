# AskTheMenu — Demo Script

A step-by-step guide for demonstrating AskTheMenu in a live setting.

## Prerequisites

- App is deployed to **https://askthemenu.vercel.app**
- Menu data is seeded in Supabase
- QR codes are generated and printed (or displayed on screen)
- Kitchen dashboard is open on a laptop/tablet: **https://askthemenu.vercel.app/kitchen**

---

## Demo Flow (5–7 minutes)

### 1. 🍽 Scan QR Code (Diner's Phone)

- Pick up a printed QR code for **Table 1**
- Scan with a phone camera → opens `https://askthemenu.vercel.app/chat/table-1`
- Point out the **"🍽 Table 1"** badge in the header
- The chatbot greets the diner

### 2. 🌶 Ask for a Spicy Recommendation

> **Diner:** "What's something really spicy?"

- The chatbot should recommend dishes with `spiceLevel: hot`
- Point out: recommendations are grounded in real menu data (RAG)

### 3. ⚠️ Ask About Allergens

> **Diner:** "Does the Chicken Karahi have any allergens?"

- The chatbot should check allergen data and respond accurately
- Point out: allergen safety is built into the guardrails

### 4. 👥 Ask for a Group Recommendation

> **Diner:** "What should two people order?"

- The chatbot should suggest a mix of shareable dishes and sides
- Point out: it considers serving sizes and variety

### 5. 🛒 Place an Order

> **Diner:** "I'll have 2x Chicken Karahi and 1x Garlic Naan"

- The chatbot confirms the items and quantities
- A **preview card** appears showing items, prices, GST, and total
- The diner taps **Approve** to send the order to the kitchen
- Point out: prices and GST are calculated server-side, not by the LLM

### 6. 👨‍🍳 Kitchen Receives Order (Laptop/Tablet)

- Switch to the kitchen dashboard
- The new order from **Table 1** appears with status **Pending**
- Show the table number, items, quantities, notes, and total

### 7. 🔄 Update Order Status

- Click **Accept** → status changes to **Accepted**
- Click **Preparing** → status changes to **Preparing**
- Click **Served** → status changes to **Served**
- Point out: status transitions follow a strict state machine (no skipping)

---

## Key Talking Points

| Feature | How It Works |
|---------|-------------|
| **RAG-powered recommendations** | Menu items are embedded with Gemini, stored in PGVector, and retrieved by semantic similarity |
| **Deterministic pricing** | LLM understands intent; backend calculates prices and GST in code |
| **Allergen safety** | Allergen data is part of the menu context; guardrails prevent false claims |
| **QR table routing** | Each table has a unique QR code linking to a table-specific chat session |
| **Human-in-the-loop ordering** | Orders require diner approval before being sent to the kitchen |
| **Real-time kitchen dashboard** | Kitchen sees incoming orders and can update status |

---

## Fallback Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Diner asks for pizza (not on menu) | "That's not on our menu, but you might enjoy…" |
| Diner says "place my order" without specifying items | Chatbot asks what they'd like to order |
| Diner asks about a non-food topic | Chatbot stays on topic, responds briefly |
| API is down | Error message shown; order is not claimed as placed |

---

## Post-Demo

- Show the `/qr` admin page with all QR codes
- Show the `/menu` page for the full menu browse
- Mention: no auth required for diners, kitchen is an unprotected route (MVP scope)
