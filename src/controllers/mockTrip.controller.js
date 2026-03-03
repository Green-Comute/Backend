/**
 * Mock Trip Controller - For Testing/Demo Purposes
 * Returns a pre-configured trip with passengers and optimized route
 */

export const getMockTrip = async (req, res) => {
  try {
    // Mock trip with 3 passengers and optimized waypoints
    const mockTrip = {
      _id: "mock-trip-123",
      driverId: {
        _id: "driver-001",
        name: "John Driver",
        email: "driver@test.com"
      },
      vehicleType: "CAR",
      totalSeats: 4,
      availableSeats: 1,
      scheduledTime: new Date(Date.now() + 3600000), // 1 hour from now
      status: "STARTED",
      source: "Coimbatore Airport",
      destination: "Gandhipuram Bus Stand",
      estimatedCost: 80,
      isOptimized: true,
      
      // Source: Coimbatore Airport
      sourceLocation: {
        type: "Point",
        coordinates: {
          type: "Point",
          coordinates: [77.0436, 11.0301] // [lng, lat]
        },
        address: "Coimbatore International Airport, Peelamedu, Coimbatore",
        lat: 11.0301,
        lng: 77.0436
      },
      
      // Destination: Gandhipuram
      destinationLocation: {
        type: "Point",
        coordinates: {
          type: "Point",
          coordinates: [76.9558, 11.0168] // [lng, lat]
        },
        address: "Gandhipuram Bus Stand, Coimbatore",
        lat: 11.0168,
        lng: 76.9558
      },
      
      // Optimized waypoints (3 passenger pickups)
      waypoints: [
        {
          lat: 11.0283,
          lng: 77.0255,
          address: "RS Puram, Coimbatore",
          passengerName: "Alice Kumar",
          passengerId: "passenger-001",
          order: 1,
          distanceFromPrevious: 2.1
        },
        {
          lat: 11.0248,
          lng: 77.0058,
          address: "Saibaba Colony, Coimbatore",
          passengerName: "Bob Sharma",
          passengerId: "passenger-002",
          order: 2,
          distanceFromPrevious: 2.5
        },
        {
          lat: 11.0195,
          lng: 76.9812,
          address: "Race Course, Coimbatore",
          passengerName: "Carol Patel",
          passengerId: "passenger-003",
          order: 3,
          distanceFromPrevious: 3.2
        }
      ],
      
      // Passenger ride requests
      rides: [
        {
          _id: "ride-001",
          status: "APPROVED",
          pickupStatus: "WAITING",
          passengerId: {
            _id: "passenger-001",
            name: "Alice Kumar",
            email: "alice@test.com"
          },
          pickupLocation: {
            address: "RS Puram, Coimbatore",
            coordinates: {
              type: "Point",
              coordinates: [77.0255, 11.0283] // [lng, lat]
            }
          }
        },
        {
          _id: "ride-002",
          status: "APPROVED",
          pickupStatus: "WAITING",
          passengerId: {
            _id: "passenger-002",
            name: "Bob Sharma",
            email: "bob@test.com"
          },
          pickupLocation: {
            address: "Saibaba Colony, Coimbatore",
            coordinates: {
              type: "Point",
              coordinates: [77.0058, 11.0248] // [lng, lat]
            }
          }
        },
        {
          _id: "ride-003",
          status: "APPROVED",
          pickupStatus: "WAITING",
          passengerId: {
            _id: "passenger-003",
            name: "Carol Patel",
            email: "carol@test.com"
          },
          pickupLocation: {
            address: "Race Course, Coimbatore",
            coordinates: {
              type: "Point",
              coordinates: [76.9812, 11.0195] // [lng, lat]
            }
          }
        }
      ],
      
      routeMetadata: {
        totalDistance: 12.5,
        estimatedDuration: 25,
        optimizationApplied: new Date()
      },
      
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(200).json({
      success: true,
      trip: mockTrip
    });
  } catch (error) {
    console.error('Mock trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mock trip',
      error: error.message
    });
  }
};
