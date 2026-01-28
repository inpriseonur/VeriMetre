-- ==========================================
-- RPC Function: get_housing_permit_trends
-- ==========================================
-- This function fetches historical housing permit data for the Trend Analysis chart.
-- 
-- IMPORTANT:
-- Please check the table name in the FROM clause.
-- I have assumed the table is named 'construction_permits' or 'housing_permits'.
-- If your table has a different name (e.g., 'supply_stats', 'economic_indicators'),
-- please update the FROM clause before running this.

CREATE OR REPLACE FUNCTION get_housing_permit_trends(months_back integer DEFAULT 24)
 RETURNS TABLE(
    period_label text,
    permit_count integer,
    avg_m2 numeric,
    year_month text
 )
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        -- Format date as "Sep '24" etc. (Adjust locale if needed)
        to_char(reference_date, 'Mon ''YY') as period_label,
        total_units::integer as permit_count,
        avg_sqm::numeric as avg_m2,
        to_char(reference_date, 'YYYY-MM') as year_month
    FROM
        construction_permits -- <--- PLEASE VERIFY THIS TABLE NAME
    WHERE
        reference_date >= (CURRENT_DATE - (months_back || ' months')::interval)
    ORDER BY
        reference_date DESC;
END;
$function$
;
