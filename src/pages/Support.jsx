import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import SupportTicketForm from '../components/support/SupportTicketForm';
import AIFeedbackAnalyzer from '../components/support/AIFeedbackAnalyzer';

export default function Support() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Support Center</h1>
          <p className="text-gray-600">We're here to help you 24/7</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
            <Phone className="w-8 h-8 text-red-600 mb-3" />
            <h3 className="font-bold text-lg mb-2">Phone Support</h3>
            <a href="tel:616-610-9210" className="text-red-600 hover:text-red-700 font-medium">
              616-610-9210
            </a>
            <p className="text-sm text-gray-600 mt-2">Mon-Fri 9AM-6PM EST</p>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
            <Mail className="w-8 h-8 text-red-600 mb-3" />
            <h3 className="font-bold text-lg mb-2">Email Support</h3>
            <a href="mailto:benjaminjohnvick@gmail.com" className="text-red-600 hover:text-red-700 font-medium break-all">
              benjaminjohnvick@gmail.com
            </a>
            <p className="text-sm text-gray-600 mt-2">24-48 hour response</p>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
            <MapPin className="w-8 h-8 text-red-600 mb-3" />
            <h3 className="font-bold text-lg mb-2">Office Location</h3>
            <p className="text-gray-700 text-sm">
              342 Harrison<br />
              Holland, MI 49423<br />
              Suite 1
            </p>
          </Card>
        </div>

        <SupportTicketForm user={user} />

        <Card className="mt-8 p-6 bg-gradient-to-r from-red-50 to-white border-2 border-red-200">
          <div className="flex items-start gap-4">
            <MessageCircle className="w-6 h-6 text-red-600 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">WhatsApp Support Available</h3>
              <p className="text-gray-600 mb-3">
                Connect with our AI support agents on WhatsApp for instant help. Visit the AI Agents page to connect.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}