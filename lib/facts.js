export const RANDOM_FACTS = [
  "The word 'Hangman' was first recorded in Victorian England in Alice Bertha Gomme's 1894 game book.",
  "'Rhythm' is the longest common English word without a standard vowel (A, E, I, O, U).",
  "The letter 'E' is the most frequently used letter in English, appearing in roughly 11% of words.",
  "The dot over the lower-case letters 'i' and 'j' is officially called a 'tittle'.",
  "'Uncopyrightable' is the longest English word that can be spelled without repeating any letter.",
  "The word 'set' has the highest number of definitions in the English dictionary (over 430!).",
  "A sentence that contains every letter of the alphabet is known as a 'pangram'.",
  "'Dreamt' is the only common English word that ends with the letters 'mt'.",
  "No common English words rhyme with month, orange, silver, or purple.",
  "The shortest complete grammatical sentence in the English language is 'I am.'",
  "'Typewriter' is one of the longest words you can write using only the top row of a standard keyboard.",
  "Shakespeare invented over 1,700 words, including 'lonely', 'swagger', 'eyeball', and 'gossip'.",
  "The word 'clue' originally meant a ball of thread used to navigate labyrinth mazes.",
  "The longest word in major English dictionaries is 45 letters: 'pneumonoultramicroscopicsilicovolcanoconiosis'.",
  "Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs that is still edible!",
  "Octopuses have three hearts, nine brains, and blue blood.",
  "Venus is the only planet in our solar system that spins clockwise.",
  "A group of flamingos is called a 'flamboyance', and a group of owls is called a 'parliament'."
];

export function getRandomFact() {
  return RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)];
}
