# **💡 IDEA**

# **AskTheMenu**

# **Problem:**

We’ve all been there!  
 You sit down at a fine-dining restaurant, open the menu, and suddenly you’re overwhelmed.  
 Too many choices. Too little time.

The waiter is waiting.  
 Your friends are arguing.  
 You don’t want to make the wrong choice.

That moment is uncomfortable—and unnecessary.

# **Solution:**

AskTheMenu is an **AI-powered conversational menu** that allows diners to interact with a restaurant’s menu by scanning a QR code and chatting with it in natural language. 

Built using Generative AI with a **Retrieval-Augmented Generation (RAG)** architecture, the system retrieves accurate, menu-specific information—such as ingredients, dietary restrictions, allergens, and pairings—and generates personalized recommendations based on user preferences and context. 

The goal is to reduce decision fatigue, enhance the dining experience, and help restaurants deliver consistent, intelligent recommendations without increasing staff workload.

## **Additional Features:**

* Sending orders directly to the kitchen  
* Estimating Order with GST before ordering (LLMs have enough capability to do multiplication addition operations)

# **🍸 Menu Format**

# **Format:**

The menu will be a collection of dishes specified in this particular format:

**### Dish Name**  
- **Ingredients:** list of primary ingredients used in the dish  
- **Allergens:** common allergens present (e.g., dairy, nuts, gluten, shellfish)  
- **Dietary:** vegetarian/non-vegetarian/vegan  
- **Spice Level:** non-spicy / mild/medium/hot  
- **Cuisine Type:** desi / chinese / continental / fusion (extendable)  
- **Specialty**: yes/no  
- **Pairings**: recommended sides, drinks, or accompaniments (must be from the menu)  
- **Price**: PKR <amount> per <quantity>  
- **Serving**: single / shareable (or define portion size)

# **🧠 Knowledge Base**

The menu will feature **four cuisine types**, each offering **20 dishes**:

* **Desi** – Traditional South Asian dishes crafted with local spices, flavors, and cooking techniques.

* **Chinese** – East Asian dishes highlighting stir-fries, sauces, noodles, and bold flavors.

* **Continental** – Western-style dishes from Europe and the Americas, typically grilled, baked, or roasted.

* **Fusion** – Innovative combinations of multiple cuisines, blending flavors, ingredients, and techniques.

In addition, **20 more items** will include staples such as naan, salads, and beverages.


# **Tech Stack:**

### Embedding model: gemini-embedding-2-preview
Example usage:
```python
from google import genai
from google.genai import types

# For Vertex AI:
# PROJECT_ID='<add_here>'
# client = genai.Client(vertexai=True, project=PROJECT_ID, location='us-central1')

client = genai.Client()

with open("example.png", "rb") as f:
    image_bytes = f.read()

with open("sample.mp3", "rb") as f:
    audio_bytes = f.read()

# Embed text, image, and audio 
result = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents=[
        "What is the meaning of life?",
        types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/png",
        ),
        types.Part.from_bytes(
            data=audio_bytes,
            mime_type="audio/mpeg",
        ),
    ],
)

print(result.embeddings)
```
### Framework: LangChain
### LLM: Gemma 4 via Open Router

Documentation: https://docs.langchain.com/oss/python/integrations/chat/openrouter
```python
from langchain_openrouter import ChatOpenRouter

model = ChatOpenRouter(
    model="anthropic/claude-sonnet-4.5",
    temperature=0,
    max_tokens=1024,
    max_retries=2,
    # other params...
)
```
### Chatbot Template: Vercel AI Chatbot (next.js + AI SDK) 
Already downloaded as 'chatbot' in root directory
### Vector Database: ChromaDB (locally on docker)
### Storage Database: Supabase
Store conversations, orders associated with tables, etc.
