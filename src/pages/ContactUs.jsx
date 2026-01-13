import React from 'react';
import { Card } from "@/components/ui/card";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Contact Us</h1>
          <p className="text-gray-600">Get in touch with the GameRewards team</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-8 bg-white/80 backdrop-blur-sm border-2 border-red-200 hover:shadow-xl transition-shadow">
            <Phone className="w-12 h-12 text-red-600 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Phone Support</h3>
            <a href="tel:616-610-9210" className="text-2xl text-red-600 hover:text-red-700 font-medium block mb-3">
              616-610-9210
            </a>
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Clock className="w-4 h-4" />
              <span>Monday - Friday: 9:00 AM - 6:00 PM EST</span>
            </div>
          </Card>

          <Card className="p-8 bg-white/80 backdrop-blur-sm border-2 border-red-200 hover:shadow-xl transition-shadow">
            <Mail className="w-12 h-12 text-red-600 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Email</h3>
            <a href="mailto:benjaminjohnvick@gmail.com" className="text-lg text-red-600 hover:text-red-700 font-medium break-all block mb-3">
              benjaminjohnvick@gmail.com
            </a>
            <p className="text-gray-600 text-sm">
              We typically respond within 24-48 hours
            </p>
          </Card>
        </div>

        <Card className="p-8 bg-white/80 backdrop-blur-sm border-2 border-red-200">
          <div className="flex items-start gap-6">
            <MapPin className="w-12 h-12 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="text-2xl font-bold mb-3">Office Location</h3>
              <div className="space-y-1 text-lg text-gray-700">
                <p className="font-medium">GameRewards Headquarters</p>
                <p>342 Harrison</p>
                <p>Suite 1</p>
                <p>Holland, Michigan 49423</p>
                <p className="text-gray-600 text-sm mt-3">United States</p>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Office Hours:</p>
                <p className="text-gray-700">Monday - Friday: 9:00 AM - 5:00 PM EST</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="mt-6 p-6 bg-gradient-to-r from-red-600 to-red-700 text-white">
          <h3 className="text-xl font-bold mb-2">Need immediate assistance?</h3>
          <p className="text-red-100">
            Visit our Support page to submit a ticket or connect with our AI support agents on WhatsApp for instant help.
          </p>
        </Card>
      </div>
    </div>
  );
}