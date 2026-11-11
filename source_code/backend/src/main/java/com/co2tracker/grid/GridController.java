package com.co2tracker.grid;

import com.co2tracker.grid.GridDtos.GridSignal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Authenticated like the rest of the API, so the upstream cannot be used through us anonymously. */
@RestController
@RequestMapping("/api/v1")
public class GridController {

    private final GridSignalService grid;

    public GridController(GridSignalService grid) {
        this.grid = grid;
    }

    @GetMapping("/grid/signal")
    public GridSignal signal() {
        return grid.current();
    }
}
