/**
 * Get IANA timezone identifier from location string
 * Supports common cities and countries
 */
export function getTimezoneFromLocation(location: string): string {
  if (!location) return 'UTC'
  
  const locationLower = location.toLowerCase()
  
  // Major cities in India (IST - Asia/Kolkata)
  if (
    locationLower.includes('mumbai') ||
    locationLower.includes('delhi') ||
    locationLower.includes('bangalore') ||
    locationLower.includes('hyderabad') ||
    locationLower.includes('chennai') ||
    locationLower.includes('kolkata') ||
    locationLower.includes('pune') ||
    locationLower.includes('ahmedabad') ||
    locationLower.includes('jaipur') ||
    locationLower.includes('surat') ||
    locationLower.includes('lucknow') ||
    locationLower.includes('kanpur') ||
    locationLower.includes('nagpur') ||
    locationLower.includes('indore') ||
    locationLower.includes('thane') ||
    locationLower.includes('bhopal') ||
    locationLower.includes('visakhapatnam') ||
    locationLower.includes('patna') ||
    locationLower.includes('vadodara') ||
    locationLower.includes('ghaziabad') ||
    locationLower.includes('ludhiana') ||
    locationLower.includes('agra') ||
    locationLower.includes('nashik') ||
    locationLower.includes('faridabad') ||
    locationLower.includes('meerut') ||
    locationLower.includes('rajkot') ||
    locationLower.includes('varanasi') ||
    locationLower.includes('srinagar') ||
    locationLower.includes('amritsar') ||
    locationLower.includes('kochi') ||
    locationLower.includes('goa') ||
    locationLower.includes('india')
  ) {
    return 'Asia/Kolkata' // IST
  }
  
  // US East Coast (EST/EDT - America/New_York)
  if (
    locationLower.includes('new york') ||
    locationLower.includes('nyc') ||
    locationLower.includes('manhattan') ||
    locationLower.includes('brooklyn') ||
    locationLower.includes('queens') ||
    locationLower.includes('bronx') ||
    locationLower.includes('philadelphia') ||
    locationLower.includes('boston') ||
    locationLower.includes('washington') ||
    locationLower.includes('dc') ||
    locationLower.includes('miami') ||
    locationLower.includes('atlanta') ||
    locationLower.includes('charlotte') ||
    locationLower.includes('tampa') ||
    locationLower.includes('orlando') ||
    locationLower.includes('baltimore') ||
    locationLower.includes('pittsburgh') ||
    locationLower.includes('detroit') ||
    locationLower.includes('buffalo') ||
    locationLower.includes('cleveland') ||
    locationLower.includes('columbus') ||
    locationLower.includes('cincinnati') ||
    locationLower.includes('indianapolis') ||
    locationLower.includes('louisville') ||
    locationLower.includes('nashville') ||
    locationLower.includes('raleigh') ||
    locationLower.includes('richmond') ||
    locationLower.includes('jacksonville') ||
    locationLower.includes('memphis') ||
    locationLower.includes('milwaukee') ||
    locationLower.includes('charleston') ||
    (locationLower.includes('eastern') && locationLower.includes('time'))
  ) {
    return 'America/New_York' // EST/EDT
  }
  
  // US Central (CST/CDT - America/Chicago)
  if (
    locationLower.includes('chicago') ||
    locationLower.includes('houston') ||
    locationLower.includes('dallas') ||
    locationLower.includes('san antonio') ||
    locationLower.includes('austin') ||
    locationLower.includes('fort worth') ||
    locationLower.includes('el paso') ||
    locationLower.includes('oklahoma city') ||
    locationLower.includes('memphis') ||
    locationLower.includes('milwaukee') ||
    locationLower.includes('kansas city') ||
    locationLower.includes('omaha') ||
    locationLower.includes('minneapolis') ||
    locationLower.includes('tulsa') ||
    locationLower.includes('wichita') ||
    locationLower.includes('arlington') ||
    locationLower.includes('new orleans') ||
    (locationLower.includes('central') && locationLower.includes('time'))
  ) {
    return 'America/Chicago' // CST/CDT
  }
  
  // US Mountain (MST/MDT - America/Denver)
  if (
    locationLower.includes('denver') ||
    locationLower.includes('phoenix') ||
    locationLower.includes('albuquerque') ||
    locationLower.includes('tucson') ||
    locationLower.includes('colorado springs') ||
    locationLower.includes('aurora') ||
    (locationLower.includes('mountain') && locationLower.includes('time'))
  ) {
    return 'America/Denver' // MST/MDT
  }
  
  // US Pacific (PST/PDT - America/Los_Angeles)
  if (
    locationLower.includes('los angeles') ||
    locationLower.includes('la') ||
    locationLower.includes('san diego') ||
    locationLower.includes('san jose') ||
    locationLower.includes('san francisco') ||
    locationLower.includes('seattle') ||
    locationLower.includes('portland') ||
    locationLower.includes('las vegas') ||
    locationLower.includes('sacramento') ||
    locationLower.includes('fresno') ||
    locationLower.includes('long beach') ||
    locationLower.includes('oakland') ||
    locationLower.includes('bakersfield') ||
    locationLower.includes('anaheim') ||
    locationLower.includes('santa ana') ||
    locationLower.includes('riverside') ||
    locationLower.includes('stockton') ||
    locationLower.includes('irvine') ||
    locationLower.includes('chula vista') ||
    locationLower.includes('fremont') ||
    locationLower.includes('san bernardino') ||
    locationLower.includes('modesto') ||
    locationLower.includes('fontana') ||
    locationLower.includes('oxnard') ||
    locationLower.includes('moreno valley') ||
    locationLower.includes('huntington beach') ||
    locationLower.includes('glendale') ||
    locationLower.includes('santa clarita') ||
    locationLower.includes('garden grove') ||
    locationLower.includes('oceanside') ||
    locationLower.includes('rancho cucamonga') ||
    locationLower.includes('santa rosa') ||
    locationLower.includes('ontario') ||
    locationLower.includes('lancaster') ||
    locationLower.includes('elk grove') ||
    locationLower.includes('corona') ||
    locationLower.includes('palmdale') ||
    locationLower.includes('salinas') ||
    locationLower.includes('pomona') ||
    locationLower.includes('hayward') ||
    locationLower.includes('escondido') ||
    locationLower.includes('torrance') ||
    locationLower.includes('sunnyvale') ||
    locationLower.includes('orange') ||
    locationLower.includes('fullerton') ||
    locationLower.includes('pasadena') ||
    locationLower.includes('thousand oaks') ||
    locationLower.includes('visalia') ||
    locationLower.includes('simi valley') ||
    locationLower.includes('concord') ||
    locationLower.includes('roseville') ||
    locationLower.includes('vallejo') ||
    locationLower.includes('victorville') ||
    locationLower.includes('fairfield') ||
    locationLower.includes('inglewood') ||
    locationLower.includes('santa clara') ||
    locationLower.includes('san mateo') ||
    locationLower.includes('richmond') ||
    locationLower.includes('antioch') ||
    locationLower.includes('vacaville') ||
    locationLower.includes('daly city') ||
    locationLower.includes('santa monica') ||
    locationLower.includes('el cajon') ||
    locationLower.includes('san leandro') ||
    locationLower.includes('lodi') ||
    locationLower.includes('compton') ||
    locationLower.includes('jurupa valley') ||
    locationLower.includes('vista') ||
    locationLower.includes('south gate') ||
    locationLower.includes('mission viejo') ||
    locationLower.includes('vacaville') ||
    locationLower.includes('carson') ||
    locationLower.includes('hesperia') ||
    locationLower.includes('santa maria') ||
    locationLower.includes('daly city') ||
    locationLower.includes('clovis') ||
    locationLower.includes('santa barbara') ||
    locationLower.includes('newport beach') ||
    locationLower.includes('san rafael') ||
    locationLower.includes('whittier') ||
    locationLower.includes('hawthorne') ||
    locationLower.includes('citrus heights') ||
    locationLower.includes('tracy') ||
    locationLower.includes('alhambra') ||
    locationLower.includes('livermore') ||
    locationLower.includes('buena park') ||
    locationLower.includes('menifee') ||
    locationLower.includes('hemet') ||
    locationLower.includes('chico') ||
    locationLower.includes('chino') ||
    locationLower.includes('redwood city') ||
    locationLower.includes('lakewood') ||
    locationLower.includes('bellflower') ||
    locationLower.includes('indio') ||
    locationLower.includes('hemet') ||
    locationLower.includes('la mesa') ||
    locationLower.includes('arcadia') ||
    locationLower.includes('tulare') ||
    locationLower.includes('redondo beach') ||
    locationLower.includes('mountain view') ||
    locationLower.includes('diamond bar') ||
    locationLower.includes('novato') ||
    locationLower.includes('san luis obispo') ||
    locationLower.includes('petaluma') ||
    locationLower.includes('san bruno') ||
    locationLower.includes('san jacinto') ||
    locationLower.includes('san juan capistrano') ||
    locationLower.includes('san marcos') ||
    locationLower.includes('san pablo') ||
    locationLower.includes('san ramon') ||
    locationLower.includes('santee') ||
    locationLower.includes('saratoga') ||
    locationLower.includes('seal beach') ||
    locationLower.includes('sherman oaks') ||
    locationLower.includes('signal hill') ||
    locationLower.includes('solana beach') ||
    locationLower.includes('south pasadena') ||
    locationLower.includes('south san francisco') ||
    locationLower.includes('temecula') ||
    locationLower.includes('tempe') ||
    locationLower.includes('thousand palms') ||
    locationLower.includes('tiburon') ||
    locationLower.includes('torrance') ||
    locationLower.includes('turlock') ||
    locationLower.includes('tustin') ||
    locationLower.includes('ukiah') ||
    locationLower.includes('union city') ||
    locationLower.includes('upland') ||
    locationLower.includes('vacaville') ||
    locationLower.includes('vallejo') ||
    locationLower.includes('ventura') ||
    locationLower.includes('victorville') ||
    locationLower.includes('vista') ||
    locationLower.includes('walnut') ||
    locationLower.includes('walnut creek') ||
    locationLower.includes('watsonville') ||
    locationLower.includes('west covina') ||
    locationLower.includes('west hollywood') ||
    locationLower.includes('westminster') ||
    locationLower.includes('whittier') ||
    locationLower.includes('wildomar') ||
    locationLower.includes('willows') ||
    locationLower.includes('windsor') ||
    locationLower.includes('woodland') ||
    locationLower.includes('yorba linda') ||
    locationLower.includes('yuba city') ||
    locationLower.includes('yucaipa') ||
    locationLower.includes('yucca valley') ||
    (locationLower.includes('pacific') && locationLower.includes('time'))
  ) {
    return 'America/Los_Angeles' // PST/PDT
  }
  
  // UK (GMT/BST - Europe/London)
  if (
    locationLower.includes('london') ||
    locationLower.includes('manchester') ||
    locationLower.includes('birmingham') ||
    locationLower.includes('glasgow') ||
    locationLower.includes('liverpool') ||
    locationLower.includes('leeds') ||
    locationLower.includes('sheffield') ||
    locationLower.includes('edinburgh') ||
    locationLower.includes('bristol') ||
    locationLower.includes('cardiff') ||
    locationLower.includes('belfast') ||
    locationLower.includes('newcastle') ||
    locationLower.includes('nottingham') ||
    locationLower.includes('southampton') ||
    locationLower.includes('leicester') ||
    locationLower.includes('coventry') ||
    locationLower.includes('sunderland') ||
    locationLower.includes('bradford') ||
    locationLower.includes('reading') ||
    locationLower.includes('kingston upon hull') ||
    locationLower.includes('preston') ||
    locationLower.includes('newport') ||
    locationLower.includes('stoke-on-trent') ||
    locationLower.includes('swansea') ||
    locationLower.includes('derby') ||
    locationLower.includes('southend-on-sea') ||
    locationLower.includes('plymouth') ||
    locationLower.includes('salford') ||
    locationLower.includes('aberdeen') ||
    locationLower.includes('westminster') ||
    locationLower.includes('portsmouth') ||
    locationLower.includes('york') ||
    locationLower.includes('peterborough') ||
    locationLower.includes('dundee') ||
    locationLower.includes('lancaster') ||
    locationLower.includes('oxford') ||
    locationLower.includes('newport') ||
    locationLower.includes('st albans') ||
    locationLower.includes('norwich') ||
    locationLower.includes('chester') ||
    locationLower.includes('cambridge') ||
    locationLower.includes('salisbury') ||
    locationLower.includes('exeter') ||
    locationLower.includes('gloucester') ||
    locationLower.includes('bath') ||
    locationLower.includes('ipswich') ||
    locationLower.includes('ely') ||
    locationLower.includes('hereford') ||
    locationLower.includes('durham') ||
    locationLower.includes('lincoln') ||
    locationLower.includes('worcester') ||
    locationLower.includes('wells') ||
    locationLower.includes('ripon') ||
    locationLower.includes('bangor') ||
    locationLower.includes('truro') ||
    locationLower.includes('perth') ||
    locationLower.includes('litchfield') ||
    locationLower.includes('city of london') ||
    locationLower.includes('united kingdom') ||
    locationLower.includes('uk') ||
    locationLower.includes('england') ||
    locationLower.includes('scotland') ||
    locationLower.includes('wales') ||
    locationLower.includes('northern ireland')
  ) {
    return 'Europe/London' // GMT/BST
  }
  
  // Default to UTC if location not recognized
  return 'UTC'
}

/**
 * Format time string in a specific timezone
 * The time is interpreted as being in the event location's timezone
 * 
 * This function creates a date object representing the specified time in the target timezone,
 * then formats it to display in 12-hour format with AM/PM in that same timezone.
 */
export function formatTimeInTimezone(
  timeString: string,
  timezone: string,
  dateString?: string
): string {
  try {
    // Parse time string (HH:MM format)
    const [hours, minutes] = timeString.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) {
      return timeString
    }
    
    // Get the date components
    let year: number, month: number, day: number
    if (dateString) {
      if (dateString.includes('T')) {
        const date = new Date(dateString)
        year = date.getFullYear()
        month = date.getMonth() + 1
        day = date.getDate()
      } else {
        const parts = dateString.split('-').map(Number)
        if (!isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          year = parts[0]
          month = parts[1]
          day = parts[2]
        } else {
          const now = new Date()
          year = now.getFullYear()
          month = now.getMonth() + 1
          day = now.getDate()
        }
      }
    } else {
      const now = new Date()
      year = now.getFullYear()
      month = now.getMonth() + 1
      day = now.getDate()
    }
    
    // To display a time in a specific timezone, we need to create a Date object
    // that represents that moment in time. The time string (e.g., "18:00") is
    // interpreted as being in the event location's timezone.
    // 
    // Approach: We'll use Intl.DateTimeFormat to find what UTC time corresponds
    // to the desired local time in the target timezone, then format it.
    
    // Create a date string for the event date at noon UTC (as a reference point)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    // Use a binary search approach: try different UTC times until we find one
    // that, when formatted in the target timezone, gives us the desired time.
    // Actually, a simpler approach: create dates and check what they format to.
    
    // Even simpler: Since we just want to format the time (not convert),
    // we can create a date in the user's local timezone, then format it in the
    // target timezone. But this will show the wrong time.
    
    // The correct approach: We need to find the UTC time that, when formatted
    // in the target timezone, shows our desired time. We can do this by:
    // 1. Creating a date at midnight UTC on the event date
    // 2. Finding what time that is in the target timezone
    // 3. Calculating the offset
    // 4. Creating a UTC date that, when offset, gives us the desired time
    
    // Create date at noon UTC on the event date (noon avoids DST edge cases)
    const noonUTC = new Date(`${dateStr}T12:00:00Z`)
    
    // Get what time noon UTC is in the target timezone
    const formatter24 = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter24.formatToParts(noonUTC)
    const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '12')
    const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
    
    // Calculate offset: if noon UTC = X:Y in target timezone, then offset is (X:Y - 12:00)
    const tzTimeMs = (tzHour * 60 + tzMinute) * 60 * 1000
    const noonMs = 12 * 60 * 60 * 1000
    const offsetMs = tzTimeMs - noonMs
    
    // Now create a UTC date that, when formatted in target timezone, shows our desired time
    // desired time in target tz = UTC time + offset
    // So: UTC time = desired time - offset
    const desiredTimeMs = (hours * 60 + (minutes || 0)) * 60 * 1000
    const utcTimeMs = desiredTimeMs - offsetMs
    
    // Create the UTC date
    const utcDate = new Date(noonUTC.getTime() - noonMs + utcTimeMs)
    
    // Format in the target timezone with 12-hour format
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(utcDate)
  } catch {
    // Fallback: just format the time directly if timezone conversion fails
    const [hours, minutes] = timeString.split(':').map(Number)
    if (!isNaN(hours) && !isNaN(minutes)) {
      const date = new Date()
      date.setHours(hours, minutes || 0, 0, 0)
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }
    return timeString
  }
}

