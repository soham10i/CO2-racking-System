package com.co2tracker.grid;

/** Fetches the raw Energy-Charts signal JSON. A seam so tests never touch the network. */
public interface GridSignalFetcher {

    /** The response body; throws on any transport error, timeout or non-200 status. */
    String fetch() throws Exception;
}
