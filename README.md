# Grocery PricePal 🍋
A crowdsourced mobile app that allows shoppers search for grocery items, compare prices through nearby stores, and submit new prices to help the community stay updated on the finest deals 

## Table of Contents
- [Project Purpose](#project-purpose)
- [Features](#features)
- [Tech Stack](#tech-stack)

## Project Purpose
Commonly grocery prices differ a lot between stores. And there's no simple way for shoppers to compare them in real time. Grocery PricePal resolves this issue where users can search for an item (e.g. "Ground Beef") and check out recent prices submitted by other users at nearby stores (Trader Joe's, Costco, Sam's Club, etc) instead of relying on speculation or memory when deciding where to shop. 

Prices are submitted either manually or by snapping a photo of a price tag, which is processed with OCR to auto fill the item name, price, and unit. Since the data is crowdsourced, the app will include a voting/reputation system. Other users would be able to confirm or dispute submitted prices and users build reputation in accordance with how accurate their submissions turn out to be. Displayed prices weighted by submitter reputation, therefore the app surfaces most likely accurate current prices. 

### Requirements
- Node.js 20 or newer
- The Expo Go app on your phone (iOS or Android), or an emulator

### Setup and run
```bash
cd grocery-app
npm install
npx expo start -c
```
Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Features
- Comparison View (Product detail): Compare side by side pricing for a specific item 
- Search: Lookup a grocery item and view price comparisons across stores
- OCR Receipt Scan/Camera: Take a photo to auto extract prices 
- Reputation/Voting System: Upvote or downvote for submitted prices to support surface accurate data 
- Price Submission: Manually submit a price you found in the store 
<!-- ** Comment: Eventually add backend/auth features ** -->

## Tech Stack
- Framework: Expo (React Native)
- Client State: Zustand
- Data Fetching / Server State: React Query
<!-- **Comment: Add backend framework, databases, OCR Service/API ** -->  

### Folder structure
```
src/
  components/   Reusable UI (AppHeader, TabBar, SearchBar, Chip, ProductCard)
  hooks/        Data hooks (useSearchItems)
  navigation/   Stack and tab navigators
  screens/      One file per screen
  services/     API calls and mock data
  store/        Zustand stores
  theme/        Colors, fonts, spacing from the Figma designs
  types/        Shared TypeScript types
  utils/        Helpers (price formatting)
```
     
