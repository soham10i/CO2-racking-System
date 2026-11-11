package com.co2tracker.user;

public final class ProfileEnums {

    private ProfileEnums() {
    }

    public enum Role { USER, ADMIN }

    public enum UserStatus { PENDING, ACTIVE, DISABLED }

    public enum Units { METRIC, IMPERIAL }

    public enum HeatingType { NATURAL_GAS, HEATING_OIL, ELECTRIC, DISTRICT, HEAT_PUMP, WOOD, OTHER }

    public enum DietType { VEGAN, VEGETARIAN, PESCATARIAN, LOW_MEAT, OMNIVORE, HIGH_MEAT }

    public enum CommuteMode { CAR, PUBLIC_TRANSPORT, BIKE, WALK, REMOTE }

    public enum CarFuel { PETROL, DIESEL, HYBRID, ELECTRIC, LPG }

    public enum ShoppingHabit { MINIMAL, MODERATE, FREQUENT }
}
