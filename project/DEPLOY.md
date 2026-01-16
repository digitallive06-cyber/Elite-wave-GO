# Deployment Guide

This guide will help you deploy your IPTV app so it's accessible from anywhere.

## Quick Deploy Options

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI** (one-time setup)
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Set Environment Variables**
   - Go to your project dashboard on Vercel
   - Navigate to Settings > Environment Variables
   - Add these variables:
     - `VITE_SUPABASE_URL` = Your Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
   - Redeploy after adding variables

4. **Done!** Your app will be live at a vercel.app URL

### Option 2: Netlify

1. **Install Netlify CLI** (one-time setup)
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod
   ```

3. **Set Environment Variables**
   - Go to Site settings > Environment variables
   - Add the same variables as above
   - Trigger a new deploy

## Environment Variables Required

Your deployment needs these environment variables:

```
VITE_SUPABASE_URL=https://ibzrtgtehpvbpwhshnvj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlienJ0Z3RlaHB2YnB3aHNobnZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Mjc0NTYsImV4cCI6MjA4NDEwMzQ1Nn0.vOHsqZbp6ibAKjavtxLBMgsph1NM3_lQzPNUCw8PoPw
```

## Updating Your Deployed App

Once deployed, any time you want to update:

### Vercel
```bash
vercel --prod
```

### Netlify
```bash
netlify deploy --prod
```

Or connect your GitHub repository for automatic deployments on every push!

## Install as App on Your Phone

Once deployed:

1. Open the deployed URL on your Android phone in Chrome
2. Tap the menu (⋮)
3. Select "Install app" or "Add to Home Screen"
4. The app will appear on your home screen like a native app

## Troubleshooting

**App not loading?**
- Check that environment variables are set correctly
- Verify the Supabase URL and key are correct
- Check browser console for errors

**Need to update Supabase settings?**
- Go to your Supabase project dashboard
- Navigate to Authentication > URL Configuration
- Add your deployed URL to the allowed redirect URLs
