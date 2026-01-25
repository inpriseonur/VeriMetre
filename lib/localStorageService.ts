import AsyncStorage from '@react-native-async-storage/async-storage';
import { MarketItem } from './marketService';

const PORTFOLIO_STORAGE_KEY = '@portfolio_assets_v1';

export interface PortfolioAsset {
    id: string; // Unique ID (e.g., Symbol or specific ID)
    symbol: string;
    name: string;
    quantity: number;
    price: number; // Last known price at the time of adding/updating
    lastUpdated: string;
}

export const getPortfolioAssets = async (): Promise<PortfolioAsset[]> => {
    try {
        const jsonValue = await AsyncStorage.getItem(PORTFOLIO_STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
        console.error('Error reading portfolio assets:', e);
        return [];
    }
};

export const savePortfolioAsset = async (asset: PortfolioAsset): Promise<void> => {
    try {
        const currentAssets = await getPortfolioAssets();
        // Check if asset already exists
        const index = currentAssets.findIndex(a => a.symbol === asset.symbol);

        let newAssets;
        if (index >= 0) {
            // Update existing
            // Strategy: Update quantity and price. 
            // If user is "adding" more, we sum quantities. If they are "editing", we might replace.
            // For simplicity in this "Add Asset" flow, let's assume we are adding/updating the record to the new state provided.
            // BUT usually "Add Asset" means "I bought +X amount". 
            // The requirement says "Selection & Input: User selects an asset ... and enters 'Quantity'".
            // Let's implement Logic: If exists, REPLACE the record with new quantity? Or ADD?
            // "Kaydet: Local Storage'a kaydet". 
            // Let's assume for now we are ADDING to the existing quantity if it exists, or replacing if it's an "Edit" mode.
            // To be safe and simple: The modal usually returns the *total* intended quantity or we handle "add" logic.
            // Let's go with: Update the record with the passed object (Replace/Upsert).
            newAssets = [...currentAssets];
            newAssets[index] = asset;
        } else {
            // Add new
            newAssets = [...currentAssets, asset];
        }

        await AsyncStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(newAssets));
    } catch (e) {
        console.error('Error saving portfolio asset:', e);
    }
};

export const removePortfolioAsset = async (symbol: string): Promise<void> => {
    try {
        const currentAssets = await getPortfolioAssets();
        const newAssets = currentAssets.filter(a => a.symbol !== symbol);
        await AsyncStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(newAssets));
    } catch (e) {
        console.error('Error removing portfolio asset:', e);
    }
};

export const calculateTotalBalance = (assets: PortfolioAsset[]): number => {
    return assets.reduce((total, asset) => total + (asset.quantity * asset.price), 0);
};

// Helper to sync prices with latest market data
// This function would be called when entering the screen to update prices
export const syncAssetPrices = async (marketData: MarketItem[]): Promise<PortfolioAsset[]> => {
    try {
        const currentAssets = await getPortfolioAssets();
        let hasChanges = false;

        const updatedAssets = currentAssets.map(asset => {
            const marketItem = marketData.find(m => m.symbol === asset.symbol); // Match by symbol
            if (marketItem && marketItem.price !== asset.price) {
                hasChanges = true;
                return {
                    ...asset,
                    price: marketItem.price,
                    lastUpdated: new Date().toISOString()
                };
            }
            return asset;
        });

        if (hasChanges) {
            await AsyncStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(updatedAssets));
        }

        return updatedAssets;

    } catch (e) {
        console.error('Error syncing asset prices:', e);
        return [];
    }
};
