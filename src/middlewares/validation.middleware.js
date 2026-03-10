import Joi from 'joi';
import { FUEL_TYPES } from '../config/fuelTypes.js';

/**
 * Reusable validation middleware using Joi
 * @param {Object} schema - Joi schema object to validate req.body against
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            abortEarly: false, // Return all errors, not just the first one
            allowUnknown: true // Allow unknown keys that are not strictly defined
        });

        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            return res.status(400).json({
                success: false,
                message: 'Input validation failed',
                errors: errorMessages
            });
        }

        next();
    };
};

// --- Common Validation Schemas ---

export const schemas = {
    // Auth
    registerEmployee: Joi.object({
        email: Joi.string().email().required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(), // Rough E.164
        password: Joi.string().min(8).required(),
        orgCode: Joi.string().required(),
        name: Joi.string().optional(),
        otp: Joi.string().length(6).required()
    }),

    login: Joi.object({
        email: Joi.string().email().optional(),
        phone: Joi.string().optional(),
        password: Joi.string().required()
    }).or('email', 'phone'), // Require either email or phone

    changePassword: Joi.object({
        oldPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).required()
    }),

    // Trip — matches tripController.createTrip expectations
    createTrip: Joi.object({
        source: Joi.string().required(),
        destination: Joi.string().required(),
        vehicleType: Joi.string().valid('CAR', 'BIKE').required(),
        totalSeats: Joi.number().integer().min(1).max(10).required(),
        scheduledTime: Joi.date().iso().required(),
        fuelType: Joi.string().valid(...FUEL_TYPES).required(),
        sourceLocation: Joi.object({
            lat: Joi.number().required(),
            lng: Joi.number().required(),
            address: Joi.string().optional()
        }).optional(),
        destinationLocation: Joi.object({
            lat: Joi.number().required(),
            lng: Joi.number().required(),
            address: Joi.string().optional()
        }).optional(),
        distanceKm: Joi.number().positive().optional(),
        conventionalEmissionFactor: Joi.number().optional(),
        sustainableEmissionFactor: Joi.number().optional(),
        waypoints: Joi.array().items(
            Joi.object({
                lat: Joi.number().required(),
                lng: Joi.number().required()
            })
        ).max(4).optional()
    })
};
