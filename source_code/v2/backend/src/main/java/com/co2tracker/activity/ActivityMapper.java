package com.co2tracker.activity;

import com.co2tracker.activity.ActivityDtos.ActivityResponse;
import com.co2tracker.activity.ActivityDtos.FactorRef;
import com.co2tracker.activity.ActivityDtos.FactorResponse;
import com.co2tracker.emission.EmissionFactor;

/** Entity to API representation; keeps persistence types out of the controllers. */
final class ActivityMapper {

    private ActivityMapper() {
    }

    static FactorRef ref(EmissionFactor f) {
        return new FactorRef(f.getId(), f.getKgCo2ePerUnit(), f.getUnit(), f.getSourceName(), f.getSourceUrl(),
                f.getVersion());
    }

    static FactorResponse factor(EmissionFactor f) {
        return new FactorResponse(f.getId(), f.getCategory(), f.getSubtype(), f.getLabel(), f.getUnit(),
                f.getKgCo2ePerUnit(), f.getRegion(), f.getSourceName(), f.getSourceUrl(), f.getMethodNote(),
                f.isShareable(), f.getMaxQuantity(), f.getValidFrom(), f.getVersion());
    }

    static ActivityResponse activity(Activity a, EmissionFactor f) {
        return new ActivityResponse(a.getId(), a.getCategory(), a.getSubtype(), f.getLabel(), a.getQuantity(),
                a.getUnit(), a.getOccurredOn(), a.getPassengers(), a.getNote(), a.getKgCo2e(), ref(f),
                a.getCreatedAt(), a.getVersion());
    }
}
