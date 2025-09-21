/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

interface Meal {
  mealType: string;
  recipeName: string;
  ingredients: string[];
  instructions: string;
  shoppingList?: string[];
}

const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [diet, setDiet] = useState<string>('');
  const [userType, setUserType] = useState<string>('');
  const [numPeople, setNumPeople] = useState<number>(1);
  const [selectedMeals, setSelectedMeals] = useState<Record<string, boolean>>({
    breakfast: false,
    brunch: false,
    lunch: false,
    snack: false,
    dinner: false,
  });
  const [pantryOption, setPantryOption] = useState<string>('pantryOnly');
  const [mealPlan, setMealPlan] = useState<Meal[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const dietOptions = ["", "Vegetarian", "Keto", "Non-Vegetarian", "Vegan", "Mediterranean"];
  const userTypeOptions = ["", "Bachelor", "Housewife", "Working Professional", "Student", "Kid"];
  const mealTimeOptions = ["breakfast", "brunch", "lunch", "snack", "dinner"];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleMealTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setSelectedMeals(prev => ({ ...prev, [name]: checked }));
  };

  const atLeastOneMealSelected = Object.values(selectedMeals).some(v => v);

  const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !diet || !userType || !atLeastOneMealSelected) {
      setError("Please fill in all the required fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setMealPlan(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fileContent = await fileToText(file);
      const selectedMealNames = Object.keys(selectedMeals).filter(meal => selectedMeals[meal]).join(', ');

      let pantryInstruction = "Strictly use only the ingredients from the pantry list provided.";
      if (pantryOption === 'allowNew') {
        pantryInstruction = "You can suggest ingredients that are not in the pantry list. If you do, please provide a separate 'shoppingList' of items to buy for each recipe that requires them.";
      }

      const prompt = `
        I am a ${userType}. I am planning meals for ${numPeople} person(s).
        My diet preference is ${diet}.
        Please suggest recipes for the following meals: ${selectedMealNames}.
        The pantry and equipment list is as follows:
        ${fileContent}
        
        ${pantryInstruction}
        
        Provide the recipe name, a list of ingredients, simple instructions, and the meal type for each recipe.
      `;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          meals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mealType: { type: Type.STRING },
                recipeName: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                instructions: { type: Type.STRING },
                shoppingList: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of ingredients to buy. Only include if new ingredients are needed."
                },
              },
              required: ["mealType", "recipeName", "ingredients", "instructions"],
            },
          },
        },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      const parsedPlan = JSON.parse(response.text);
      setMealPlan(parsedPlan.meals);

    } catch (e) {
      console.error(e);
      setError("Sorry, we couldn't generate a meal plan. Please check the file format or try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <header>
        <h1>Meal & Recipe Planner</h1>
        <p className="subtitle">Get personalized meal plans based on your pantry and diet.</p>
      </header>
      
      <form onSubmit={handleSubmit} className="form-section" aria-labelledby="form-heading">
        <h2 id="form-heading" className="visually-hidden">Planner Inputs</h2>

        <div className="input-group">
          <label htmlFor="file-upload">1. Upload Pantry & Equipment List</label>
          <p className="input-hint">Supported formats: .txt, .csv, .md, .json</p>
          <div className="file-input-wrapper">
            <input type="file" id="file-upload" onChange={handleFileChange} accept=".txt,.csv,.md,.json" aria-describedby="file-name" />
            <label htmlFor="file-upload" className="file-input-label">{file ? 'Change file' : 'Choose a file'}</label>
          </div>
          {file && <span id="file-name" className="file-name-display">{file.name}</span>}
        </div>

        <div className="input-group">
          <label htmlFor="user-type-select">2. Tell Us About Yourself</label>
          <select id="user-type-select" value={userType} onChange={(e) => setUserType(e.target.value)} required>
            {userTypeOptions.map(option => <option key={option} value={option} disabled={option === ""}>{option === "" ? "Select user type..." : option}</option>)}
          </select>
        </div>
        
        <div className="input-group">
          <label htmlFor="num-people-input">3. How many people?</label>
          <input id="num-people-input" type="number" value={numPeople} onChange={(e) => setNumPeople(Number(e.target.value))} min="1" className="number-input" required />
        </div>

        <div className="input-group">
          <label>4. Select Diet</label>
          <select id="diet-select" value={diet} onChange={(e) => setDiet(e.target.value)} required>
            {dietOptions.map(option => <option key={option} value={option} disabled={option === ""}>{option === "" ? "Select a diet..." : option}</option>)}
          </select>
        </div>
        
        <div className="input-group">
          <fieldset>
            <legend>5. Choose Meal Times</legend>
            <div className="checkbox-group">
              {mealTimeOptions.map(meal => (
                <div key={meal}>
                  <input type="checkbox" id={`meal-${meal}`} name={meal} checked={selectedMeals[meal]} onChange={handleMealTimeChange} />
                  <label htmlFor={`meal-${meal}`}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        
        <div className="input-group">
          <fieldset>
            <legend>6. Pantry Preference</legend>
             <div className="radio-group">
                <div>
                    <input type="radio" id="pantryOnly" name="pantryOption" value="pantryOnly" checked={pantryOption === 'pantryOnly'} onChange={(e) => setPantryOption(e.target.value)} />
                    <label htmlFor="pantryOnly">Use Pantry Items Only</label>
                </div>
                <div>
                    <input type="radio" id="allowNew" name="pantryOption" value="allowNew" checked={pantryOption === 'allowNew'} onChange={(e) => setPantryOption(e.target.value)} />
                    <label htmlFor="allowNew">Allow New Ingredients (will create a shopping list)</label>
                </div>
            </div>
          </fieldset>
        </div>

        <button type="submit" className="btn btn-primary" disabled={!file || !diet || !userType || !atLeastOneMealSelected || loading}>
          {loading ? 'Generating...' : 'Generate Meal Plan'}
        </button>
      </form>

      {loading && (
        <div className="loader-container" role="status" aria-label="Loading meal plan">
          <div className="loader"></div>
        </div>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}

      {mealPlan && (
        <section className="results-section" aria-labelledby="results-heading">
          <h2 id="results-heading">Your Personalized Meal Plan</h2>
          <div className="meals-grid">
            {mealPlan.map((mealData) => (
              <div key={mealData.recipeName} className="meal-card">
                <h3>{mealData.mealType}</h3>
                <h4>{mealData.recipeName}</h4>
                
                {mealData.shoppingList && mealData.shoppingList.length > 0 && (
                    <div className="shopping-list">
                        <h5>Shopping List</h5>
                        <ul>
                            {mealData.shoppingList.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                )}
                
                <h5>Ingredients</h5>
                <ul>
                  {mealData.ingredients.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
                <h5>Instructions</h5>
                <p>{mealData.instructions}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);