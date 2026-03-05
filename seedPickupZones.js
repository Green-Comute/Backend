import 'dotenv/config';
import SmartPickupZone from './src/models/SmartPickupZone.js';
import connectDB from './src/config/db.js';

/**
 * Seed Smart Pickup Zones
 * 
 * Run: node seedPickupZones.js
 */

const sampleZones = [
  {
    name: "Coimbatore Railway Junction",
    type: "TRANSIT_HUB",
    location: {
      type: "Point",
      coordinates: [76.9558, 11.0168]
    },
    address: "Dr Nanjappa Road, Coimbatore Junction, Tamil Nadu 641018",
    description: "Main entrance near platform 1, designated pickup area outside gate 2",
    radius: 100,
    isActive: true
  },
  {
    name: "Brookefields Mall Parking",
    type: "PARKING_LOT",
    location: {
      type: "Point",
      coordinates: [76.9945, 11.0301]
    },
    address: "Brookefields Mall, Avinashi Road, Coimbatore, Tamil Nadu 641037",
    description: "Level P2, near food court exit. Well-lit and secure area.",
    radius: 150,
    isActive: true
  },
  {
    name: "Coimbatore Airport Pickup Point",
    type: "PICKUP_POINT",
    location: {
      type: "Point",
      coordinates: [77.0434, 11.0299]
    },
    address: "Coimbatore International Airport, Peelamedu, Tamil Nadu 641014",
    description: "Designated rideshare pickup zone at arrivals gate, follow yellow signage",
    radius: 75,
    isActive: true
  },
  {
    name: "Gandhipuram Bus Stand Taxi Point",
    type: "TAXI_STAND",
    location: {
      type: "Point",
      coordinates: [76.9558, 11.0183]
    },
    address: "Gandhipuram Central Bus Stand, Dr Krishnasamy Mudaliar Road, Coimbatore, Tamil Nadu 641012",
    description: "Main taxi stand near gate 3, next to platform entrance",
    radius: 80,
    isActive: true
  },
  {
    name: "RS Puram Taxi Stand",
    type: "TAXI_STAND",
    location: {
      type: "Point",
      coordinates: [76.9532, 11.0065]
    },
    address: "RS Puram Junction, DB Road, Coimbatore, Tamil Nadu 641002",
    description: "Near Indian Bank junction, opposite to cinema theatre",
    radius: 50,
    isActive: true
  },
  {
    name: "Fun Mall Pickup Zone",
    type: "PICKUP_POINT",
    location: {
      type: "Point",
      coordinates: [77.0067, 11.0304]
    },
    address: "Fun Mall, Avinashi Road, Coimbatore, Tamil Nadu 641018",
    description: "Designated pickup area near main entrance, blue zone marking",
    radius: 100,
    isActive: true
  },
  {
    name: "KMCH Hospital Pickup Point",
    type: "PICKUP_POINT",
    location: {
      type: "Point",
      coordinates: [76.9645, 11.0270]
    },
    address: "KMCH College Road, Coimbatore, Tamil Nadu 641014",
    description: "Hospital main gate parking area, near outpatient block",
    radius: 120,
    isActive: true
  },
  {
    name: "Ukkadam Bus Stand",
    type: "TRANSIT_HUB",
    location: {
      type: "Point",
      coordinates: [76.9737, 10.9975]
    },
    address: "Ukkadam, Trichy Road, Coimbatore, Tamil Nadu 641001",
    description: "Main bus terminus, pickup zone near platform 8-10",
    radius: 100,
    isActive: true
  },
  {
    name: "Prozone Mall Parking",
    type: "PARKING_LOT",
    location: {
      type: "Point",
      coordinates: [76.9938, 11.0625]
    },
    address: "Prozone Mall, Saravanampatti, Coimbatore, Tamil Nadu 641035",
    description: "Multi-level parking, pickup area on ground floor near entrance A",
    radius: 150,
    isActive: true
  },
  {
    name: "Singanallur Bus Stop Pickup Zone",
    type: "PICKUP_POINT",
    location: {
      type: "Point",
      coordinates: [77.0010, 10.9948]
    },
    address: "Singanallur Bus Stop, Trichy Road, Coimbatore, Tamil Nadu 641005",
    description: "Near bus stop shelter, designated waiting area with seating",
    radius: 80,
    isActive: true
  }
];

const seedPickupZones = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log(' Starting to seed smart pickup zones...');

    // Clear existing zones (optional - comment out if you want to keep existing)
    const deleteCount = await SmartPickupZone.deleteMany({});
    console.log(`  Cleared ${deleteCount.deletedCount} existing zones`);

    // Insert sample zones
    const zones = await SmartPickupZone.insertMany(sampleZones);
    console.log(` Successfully seeded ${zones.length} smart pickup zones:`);
    
    zones.forEach(zone => {
      console.log(`   - ${zone.name} (${zone.type})`);
    });

    console.log('\n Seeding complete!');
    process.exit(0);

  } catch (error) {
    console.error(' Error seeding pickup zones:', error);
    process.exit(1);
  }
};

// Run the seed function
seedPickupZones();
