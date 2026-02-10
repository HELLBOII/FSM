/**
 * Calculate the best technician for a service request based on multiple factors
 */
export function calculateBestTechnician(serviceRequest, technicians) {
  if (!serviceRequest || !technicians || technicians.length === 0) {
    return [];
  }

  const scoredTechnicians = technicians.map(tech => {
    let score = 0;
    const matchReasons = [];

    // 1. Availability (most important - 40 points)
    if (tech.availability_status === 'available') {
      score += 40;
      matchReasons.push('Available');
    } else if (tech.availability_status === 'break') {
      score += 20;
    }

    // 2. Skills/Specializations match (30 points)
    const irrigationType = serviceRequest.irrigation_type;
    const issueCategory = serviceRequest.issue_category;
    
    if (tech.specializations && Array.isArray(tech.specializations)) {
      const irrigationMatch = tech.specializations.some(spec => 
        spec.toLowerCase().includes(irrigationType?.toLowerCase())
      );
      
      const categoryMatch = tech.specializations.some(spec =>
        issueCategory?.toLowerCase().includes(spec.toLowerCase()) ||
        spec.toLowerCase().includes(issueCategory?.toLowerCase()?.replace(/_/g, ' '))
      );

      if (irrigationMatch) {
        score += 20;
        matchReasons.push('Irrigation specialist');
      }
      if (categoryMatch) {
        score += 10;
        matchReasons.push('Issue specialist');
      }
    }

    // 3. Rating (15 points)
    if (tech.rating) {
      score += (tech.rating / 5) * 15;
      if (tech.rating >= 4.5) {
        matchReasons.push('Top rated');
      }
    }

    // 4. Proximity to job site (10 points)
    let distance = null;
    if (tech.current_location?.lat && tech.current_location?.lng && 
        serviceRequest.location?.lat && serviceRequest.location?.lng) {
      distance = calculateDistance(
        tech.current_location.lat, 
        tech.current_location.lng,
        serviceRequest.location.lat, 
        serviceRequest.location.lng
      );
      
      // Closer is better (max 10 points if within 5km)
      if (distance < 5) {
        score += 10;
        matchReasons.push('Nearby');
      } else if (distance < 15) {
        score += 5;
      }
    }

    // 5. Workload - fewer jobs = higher score (5 points)
    const jobsCompleted = tech.jobs_completed || 0;
    if (jobsCompleted < 100) {
      score += 5;
    } else if (jobsCompleted < 150) {
      score += 3;
    }

    return {
      ...tech,
      score,
      distance,
      matchReasons: matchReasons.slice(0, 3) // Show top 3 reasons
    };
  });

  // Sort by score (highest first)
  return scoredTechnicians
    .sort((a, b) => b.score - a.score)
    .filter(t => t.score > 0); // Only return technicians with some score
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}