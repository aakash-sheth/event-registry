# Envelope Animation Controls

## How to View/Test the Animation

### Method 1: Force Animation via URL Parameter
Add `?showAnimation=true` to your invite page URL:
```
http://localhost:3000/invite/your-slug?showAnimation=true
```

This will:
- Clear the session storage flag
- Force the animation to show
- Allow you to test it multiple times

### Method 2: Clear Session Storage
Open browser console and run:
```javascript
sessionStorage.removeItem('envelope_animation_shown')
```
Then refresh the page.

### Method 3: Open in Incognito/Private Window
The animation shows once per session, so opening in a new incognito window will show it.

## Configuration

### Enable/Disable Animation
The animation can be controlled via the page configuration:

```json
{
  "animations": {
    "envelope": true  // or false to disable
  }
}
```

By default, the animation is **enabled** (if not specified, it defaults to `true`).

## Animation Behavior

1. **Shows on first page load** (once per browser session)
2. **Respects accessibility**: Automatically disabled if user has `prefers-reduced-motion` enabled
3. **Skippable**: Click/tap anywhere on the animation to skip
4. **Session-based**: Won't show again in the same browser session (until you clear sessionStorage)

## Animation Sequence

1. **Envelope appears** (0.5s)
2. **Letter extracts** upward (1s)
3. **Envelope splits** - flap opens, body moves down (0.8s)
4. **Content fades in** (0.5s)
5. **Total duration**: ~2.8 seconds

## Troubleshooting

### Animation not showing?
1. Check if it's been shown this session: `sessionStorage.getItem('envelope_animation_shown')`
2. Check if animation is disabled in config: `config.animations?.envelope === false`
3. Check if user has reduced motion enabled
4. Try adding `?showAnimation=true` to URL
5. Check browser console for any errors

### Animation showing too often?
- The animation uses `sessionStorage`, so it only shows once per browser session
- To reset, clear sessionStorage: `sessionStorage.removeItem('envelope_animation_shown')`


