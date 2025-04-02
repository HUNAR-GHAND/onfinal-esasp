from flask import Flask, request, jsonify
import re
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS
import nltk
from nltk.corpus import stopwords
from newsapi import NewsApiClient

import string

# Download required resources



nltk.download('stopwords')
nltk.download('punkt')

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_host=1)  # Fix proxy settings




stop_words = set(stopwords.words('english')) - {"not", "be", "is", "are", "was", "were"}  # Preserve key negations

newsapi = NewsApiClient(api_key='5377bcd48ed54618b419026543872b74')


# Words to remove only if they do not affect meaning
redundant_words = {
    "breaking", "new", "update", "exclusive", "just in", "here's", "revealed", "say officials"
    "reasons", "behind", "launches", "learning", "report", "study", "experts", "say ","officials"
    "says", "claims", "major", "important", "significant", "shocking", "unexpected",
    "amazing", "unbelievable", "must-see", "find out", "truth", "latest", "soon",
    "happened", "live", "announces", "introduces", "releases", "shares", "discusses",
    "breaking news", "exclusive report", "top stories", "special coverage", "detailed analysis",
    "everything you need to know", "in-depth", "full story", "revealing", "inside story",
    "how-to", "revolutionary", "biggest", "most", "fastest", "game-changer", "sensational",
    "uncovered", "insider", "whopping", "mind-blowing", "earth-shattering", "massive",
    "heartbreaking", "viral", "trending", "epic", "outrageous", "shocking truth",
    "incredible", "you won’t believe", "jaw-dropping", "explosive", "eye-opening",
    "powerful", "groundbreaking", "record-breaking", "controversial", "debate",
    "must-read", "this will change everything", "history-making", "never seen before",
    "bizarre", "insane", "spectacular", "phenomenal", "disruptive", "insightful","must","has"
    "blockbuster", "mind-blowing truth", "essential", "key insights", "hot take","will","can","could",
    "big reveal", "major twist", "unexpected outcome", "mystery solved", "big secret","do","did",
    "insanely", "dramatic", "revealing facts", "all you need to know", "instant reaction","is", "am","news",
    "reaction", "critics say", "analysts predict", "must-watch", "sensational facts","are","has","have",
    "this just happened", "unmasking", "scandal", "whistleblower", "busted", "shockwave","when","whose",
    "secrets revealed", "unveiled", "never-before-seen", "exposed", "jaw-dropping revelation","where","what","how"
}

def shorten_headline(headline):
    words = nltk.word_tokenize(headline.lower())
    filtered_words = [re.sub(r'[^a-zA-Z0-9.\s]', '', word) for word in words]
    filtered_words = [word for word in filtered_words if word and word not in stop_words and word not in redundant_words]
    
    # Preserve key terms related to legal matters
    important_terms = ["rape", "charge", "judge", "court", "accused", "minor offence", "assault", "abuse"]
    preserved_words = [word for word in words if word in important_terms or word in filtered_words]
    
    # Remove duplicate words while maintaining order
    unique_words = list(dict.fromkeys(preserved_words))
    
    if unique_words:
        unique_words[0] = unique_words[0].capitalize()
    
    return " ".join(unique_words)

@app.route('/shorten', methods=['POST'])
def process_news_headlines():
    data = request.get_json()
    if not data or 'headlines' not in data:
        return jsonify({"error": "Invalid request. Please provide 'headlines' as a list."}), 400
    
    headlines = data['headlines']
    shortened_headlines = [shorten_headline(headline) for headline in headlines]
    return jsonify({"shortened_headlines": shortened_headlines})

@app.route("/get-news", methods=['GET'])
def process_get_news():
    all_articles = newsapi.get_everything(q='bitcoin',
                                    
                                      
                                      from_param='2025-04-01',
                                      to='2025-03-01',
                                      language='en',
                                      sort_by='relevancy')
    return jsonify({"headlines": all_articles})


    

if __name__ == "__main__":
    app.run(debug=True)