import React from 'react';
import PricingSection from '@/components/home/PricingSection';
import BusinessPricingSection from '@/components/home/BusinessPricingSection';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-white">
      <PricingSection />
      <BusinessPricingSection />
    </div>
  );
}