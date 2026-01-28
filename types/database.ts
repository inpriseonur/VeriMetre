
export interface InflationMetric {
    id: number;
    reference_date: string;
    source_id: number;
    monthly_rate: number;
    yearly_rate: number;
    created_at?: string;
}

export interface HousingMetric {
    id: number;
    reference_date: string;
    total_sales_count: number;
    price_per_sqm_try: number;
    construction_cost_index: number;
    created_at?: string;
}

export interface MinimumWageHistory {
    id: number;
    valid_from: string;
    net_amount_try: number;
    usd_equivalent: number;
    gold_equivalent_grams: number;
    created_at?: string;
}

export interface ViewInflationCalculated {
    reference_date: string;
    source_id: number;
    monthly_rate: number;
    calculated_yearly_rate: number;
    calculated_ytd_rate?: number; // Optional for safety if view not fully migrated yet
}

export interface Announcement {
    id: number;
    title: string;
    message: string;
    target_screen: string;
    target_params?: any;
    icon_name: string;
    bg_color: string;
}

export interface ViewLivingStandards {
    reference_date: string;
    hunger_threshold: number;
    current_min_wage: number;
    inflation_tuik: number;
    inflation_enag: number;
    inflation_ito: number;
    min_wage_usd_real?: number;
    min_wage_gold_real?: number;
}

export interface DataSource {
    id: number;
    name: string;
    created_at?: string;
}
