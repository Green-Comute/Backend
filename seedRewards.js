import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RewardItem from './src/models/RewardItem.js';
import User from './src/models/User.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/greencommute')
    .then(async () => {
        console.log('MongoDB connected');

        // Find a user or org to attach rewards to
        const orgUser = await User.findOne({ role: 'ORG_ADMIN' }) || await User.findOne();
        if (!orgUser) {
            console.log('No users found. Start the app and register someone first.');
            process.exit(1);
        }
        const orgId = orgUser.organizationId;
        console.log(`Using organization ID: ${orgId}`);

        const baseRewards = [
            {
                organizationId: orgId,
                name: '₹500 Amazon Gift Card',
                description: 'Get a ₹500 digital gift card for Amazon India. Perfect for buying books, electronics, and more! Emailed directly to you upon admin approval.',
                pointCost: 500,
                stock: 50,
                category: 'VOUCHER',
                imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&q=80',
                isActive: true,
            },
            {
                organizationId: orgId,
                name: 'Amrita University Branded Hoodie',
                description: 'Stay warm with our premium organic cotton Amrita University hoodie. Available in sizes S to XXL (we will contact you for sizing).',
                pointCost: 1500,
                stock: 25,
                category: 'MERCHANDISE',
                imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80',
                isActive: true,
            },
            {
                organizationId: orgId,
                name: 'Lunch with the CEO',
                description: 'Redeem your points for an exclusive 1-on-1 lunch with our CEO at a premium restaurant. Discuss ideas, career growth, and more!',
                pointCost: 5000,
                stock: 5,
                category: 'EXPERIENCE',
                imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
                isActive: true,
            },
            {
                organizationId: orgId,
                name: '₹1000 Swiggy Voucher',
                description: 'Hungry? Get ₹1000 off your next Swiggy order. Applicable on food delivery, Instamart, and more.',
                pointCost: 900,
                stock: null, // unlimited
                category: 'VOUCHER',
                imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
                isActive: true,
            },
            {
                organizationId: orgId,
                name: 'Extra Day of PTO',
                description: 'Take a break! Redeem an extra day of paid time off. Subject to manager approval.',
                pointCost: 10000,
                stock: null, // unlimited
                category: 'EXPERIENCE',
                imageUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                isActive: true,
            }
        ];

        // Clear existing for this org just in case
        await RewardItem.deleteMany({ organizationId: orgId });

        await RewardItem.insertMany(baseRewards);
        console.log(`Inserted ${baseRewards.length} dummy rewards successfully!`);

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
