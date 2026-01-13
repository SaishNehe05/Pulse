Pulse 📡
Pulse is a mobile-first newsletter and publishing platform built with React Native and Supabase. Inspired by Substack, it allows creators to publish content directly to their subscribers' mobile devices with a clean, native reading experience.

🚀 Features
Native Reading Experience: Optimized for mobile with smooth scrolling and high-readability fonts.

Real-time Updates: Powered by Supabase Realtime to notify users of new posts instantly.

Markdown Support: Write and render posts using clean Markdown syntax.

Secure Authentication: Secure "Magic Link" or Social login via Supabase Auth.

Image Hosting: Optimized image storage and delivery using Supabase Storage.

🛠️ Tech Stack
Mobile Frontend
Framework: React Native (or Expo)

Navigation: React Navigation

Styling: NativeWind (Tailwind for React Native) or StyleSheet

Icons: Lucide React Native

Backend (Supabase)
Database: PostgreSQL (Hosted on Supabase)

Authentication: Supabase Auth (Magic Links/OTP)

Storage: Supabase Storage (for newsletter images/banners)

Serverless Logic: Supabase Edge Functions (for triggering email sends)

Infrastructure
Email Engine: Resend or Nodemailer (triggered via Edge Functions)

🏁 Getting Started
Prerequisites
Node.js and npm/yarn

Expo Go app on your phone (if using Expo)

A Supabase account and project

Installation
Clone the repo:

Bash

git clone https://github.com/yourusername/pulse.git
cd pulse
Install dependencies:

Bash

npm install
Environment Variables: Create a .env file in the root directory:

Code snippet

EXPO_PUBLIC_SUPABASE_URL="[https://your-project-id.supabase.co](https://lkvjnjhiiakhuenbbeaw.supabase.co)"
EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdmpuamhpaWFraHVlbmJiZWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTMwNzAsImV4cCI6MjA4MzYyOTA3MH0.1VLYy6L_1d5kUEeIB1dJ2f52ZjxRvloBSOO0ELbcaRY"
Start the app:

Bash

npx expo start
📱 Database Schema
Pulse uses a simple, effective schema:

profiles: User information and creator status.

posts: Content, titles, and publication dates.

subscriptions: Mapping users to the creators they follow.

📄 License
This project is licensed under the MIT License.
