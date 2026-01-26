import { supabase } from './supabase';

// --- Types ---

export interface Portfolio {
    id: string; // UUID
    created_at: string;
    user_id: string;
    name: string;
    type: 'BES' | 'GOLD' | 'STOCK' | 'OTHER';
    initial_principal: number;
}

export interface PortfolioItem {
    id: string; // UUID
    portfolio_id: string;
    fund_code: string;
    quantity: number;
    // Joined fields (optional)
    fund_definitions?: {
        code: string;
        title: string;
        last_price: number;
    };
    current_value?: number; // Calculated field
}

export interface PortfolioTransaction {
    id: string; // UUID
    portfolio_id: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    transaction_date: string;
}

export interface PortfolioSummary {
    portfolio_id: string;
    portfolio_name: string;
    portfolio_type: string;
    current_balance: number;
    total_invested: number;
    profit_loss_amount: number;
    profit_loss_percentage: number;
}

// --- Services ---

// 1. Create Portfolio
export const createPortfolio = async (name: string, type: string, initialPrincipal: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('portfolios')
        .insert({
            user_id: user.id,
            name,
            type,
            initial_principal: initialPrincipal
        })
        .select()
        .single();

    if (error) throw error;
    return data as Portfolio;
};

// 2. Get Portfolios (Summary View)
export const getPortfolios = async () => {
    const { data, error } = await supabase
        .from('view_portfolio_summary')
        .select('*');

    if (error) throw error;
    return data as PortfolioSummary[];
};

// 3. Get Portfolio Details (Items + Transactions + Metadata)
// Uses multiple queries or joins. For items, we join with fund_definitions.
export const getPortfolioDetails = async (portfolioId: string) => {
    // A. Get Portfolio Metadata
    const { data: portfolio, error: pError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', portfolioId)
        .single();

    if (pError) throw pError;

    // B. Get Items with Fund Price
    const { data: items, error: iError } = await supabase
        .from('portfolio_items')
        .select(`
            *,
            fund_definitions (
                fund_code,
                title,
                last_price
            )
        `)
        .eq('portfolio_id', portfolioId);

    if (iError) throw iError;

    // Calculate item current values client-side if needed or trust the view for totals
    // But for listing items, we need specific values.
    const enrichedItems = (items || []).map((item: any) => ({
        ...item,
        current_value: (item.quantity * (item.fund_definitions?.last_price || 0))
    }));

    return {
        portfolio: portfolio as Portfolio,
        items: enrichedItems as PortfolioItem[]
    };
};

// 4. Add Transaction (Cash Flow)
export const addPortfolioTransaction = async (portfolioId: string, type: 'DEPOSIT' | 'WITHDRAWAL', amount: number) => {
    const { data, error } = await supabase
        .from('portfolio_transactions')
        .insert({
            portfolio_id: portfolioId,
            type,
            amount,
            transaction_date: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    return data as PortfolioTransaction;
};

// 5. Upsert Portfolio Item (Add Fund or Update Quantity)
// If logic requires adding to existing quantity, we should handle handle that. 
// But "Update" usually means "Set new quantity" or "Add to quantity".
// The user flow says "Add Fund" (Create) and "Update" (Rebalance). 
// Let's create a helper that handles "Add" (upsert based on unique constraint portfolio_id + fund_code).
export const upsertPortfolioItem = async (portfolioId: string, fundCode: string, quantity: number) => {
    // First check if it exists to add or replace? 
    // Usually "Add fund" implies adding a new row. But if I buy MORE of the same fund, I update the quantity.
    // Let's assume the user enters the TOTAL quantity or the ADDED quantity? 
    // User flow 2: "Mevcut fonlar listelenir, kullanıcı adetlerini güncelleyebilir". This implies SETTING the absolute quantity.

    // For "Add Fund" flow, if user selects an existing fund, it should probably add to it or warn?
    // Let's stick to upserting the absolute quantity for "Update" flow.
    // For "Add Fund" flow, if it's new, we insert.

    // Simplest: Upsert based on portfolio_id+fund_code.

    // We need to check if we can do 'upsert' on text columns easily? 
    // Assuming there is a unique constraint on (portfolio_id, fund_code).

    // Wait, simpler approach: Check if exists.
    const { data: existing } = await supabase
        .from('portfolio_items')
        .select('id, quantity')
        .eq('portfolio_id', portfolioId)
        .eq('fund_code', fundCode)
        .maybeSingle();

    let error;
    let data;

    if (existing) {
        // Update
        // Decide if we Add or Set. For "Add Asset Modal", usually we are adding a NEW holding.
        const { data: d, error: e } = await supabase
            .from('portfolio_items')
            .update({ quantity: quantity }) // BE CAREFUL: Is this replacing or adding?
            // If I use the "Add Asset" modal and type 100, and I already have 50. Should it be 150 or 100?
            // User said: "adetlerini güncelleyebilir" in Update flow -> Replace.
            // In Add flow? "fon seçilince adet girme". 
            // I'll make a dedicated function for "Add" and "Update".
            .eq('id', existing.id)
            .select();
        error = e;
        data = d;
    } else {
        // Insert
        const { data: d, error: e } = await supabase
            .from('portfolio_items')
            .insert({
                portfolio_id: portfolioId,
                fund_code: fundCode,
                quantity: quantity
            })
            .select();
        error = e;
        data = d;
    }

    if (error) throw error;
    return data;
};

export const deletePortfolioItem = async (itemId: string) => {
    const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', itemId);

    if (error) throw error;
};

// Helper to Add to existing quantity (Buying more)
export const addToPortfolioItem = async (portfolioId: string, fundCode: string, additionalQuantity: number) => {
    const { data: existing } = await supabase
        .from('portfolio_items')
        .select('id, quantity')
        .eq('portfolio_id', portfolioId)
        .eq('fund_code', fundCode)
        .maybeSingle();

    if (existing) {
        return upsertPortfolioItem(portfolioId, fundCode, existing.quantity + additionalQuantity);
    } else {
        return upsertPortfolioItem(portfolioId, fundCode, additionalQuantity);
    }
}
