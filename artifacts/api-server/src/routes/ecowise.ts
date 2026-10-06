import { Router, type IRouter, type Response } from "express";
import {
  AnalyzeActivityBody,
  AnalyzeActivityResponse,
  CompleteRecommendationParams,
  CompleteRecommendationResponse,
  GetActivitiesQueryParams,
  GetActivitiesResponse,
  GetActivityParams,
  GetActivityResponse,
  GetBadgesResponse,
  GetChallengesResponse,
  GetDashboardResponse,
  JoinChallengeParams,
  JoinChallengeResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import type { AuthenticatedSupabase } from "../lib/supabase";
import { requireSupabaseUser } from "../lib/supabase";

type Row = Record<string, unknown>;
type ActivityCategory =
  | "Transportation"
  | "Energy"
  | "Water"
  | "Food"
  | "Shopping"
  | "Waste"
  | "Lifestyle"
  | "Other";

type RecommendationDraft = {
  title: string;
  description: string;
  difficulty: "Easy" | "Moderate" | "Challenging";
  points: number;
  estimatedImpact: string;
};

const router: IRouter = Router();
router.use(requireSupabaseUser);

function context(res: Response): AuthenticatedSupabase {
  return res.locals.eco as AuthenticatedSupabase;
}

function assertNoError<T>(data: T, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data;
}

async function loadProfile(
  client: AuthenticatedSupabase["client"],
  user: AuthenticatedSupabase["user"],
): Promise<Row> {
  const selected = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  assertNoError(selected.data, selected.error);

  if (selected.data) return selected.data as Row;

  const inserted = await client
    .from("profiles")
    .insert({
      id: user.id,
      full_name:
        typeof user.user_metadata["full_name"] === "string"
          ? user.user_metadata["full_name"]
          : "",
      email: user.email ?? "",
    })
    .select("*")
    .single();
  assertNoError(inserted.data, inserted.error);
  return inserted.data as Row;
}

function mapProfile(row: Row) {
  return {
    id: row["id"],
    fullName: row["full_name"] ?? "",
    email: row["email"] ?? "",
    avatarUrl: row["avatar_url"] ?? null,
    ecoScore: row["eco_score"] ?? 0,
    totalPoints: row["total_points"] ?? 0,
    currentStreak: row["current_streak"] ?? 0,
    longestStreak: row["longest_streak"] ?? 0,
    totalActivities: row["total_activities"] ?? 0,
    lastActivityDate: row["last_activity_date"] ?? null,
    preferredCategory: row["preferred_category"] ?? null,
  };
}

function mapRecommendation(row: Row) {
  return {
    id: row["id"],
    activityId: row["activity_id"],
    title: row["title"],
    description: row["description"],
    category: row["category"],
    difficulty: row["difficulty"],
    points: row["points"],
    estimatedImpact: row["estimated_impact"],
    isCompleted: row["is_completed"],
    createdAt: row["created_at"],
  };
}

function mapActivity(row: Row) {
  const recommendations = Array.isArray(row["recommendations"])
    ? (row["recommendations"] as Row[]).map(mapRecommendation)
    : [];
  return {
    id: row["id"],
    inputText: row["input_text"],
    category: row["category"],
    activityName: row["activity_name"],
    currentChoice: row["current_choice"],
    frequency: row["frequency"],
    impactLevel: row["impact_level"],
    analysis: row["analysis"],
    createdAt: row["created_at"],
    pointsEarned: recommendations.reduce(
      (total, item) =>
        total +
        (item.isCompleted === true && typeof item.points === "number"
          ? item.points
          : 0),
      0,
    ),
    recommendations,
  };
}

function mapBadge(row: Row) {
  return {
    id: row["id"],
    name: row["name"],
    description: row["description"],
    icon: row["icon"],
  };
}

function mapChallenge(row: Row, enrollment?: Row) {
  return {
    id: row["id"],
    title: row["title"],
    description: row["description"],
    category: row["category"] ?? null,
    points: row["points"],
    targetCount: row["target_count"],
    durationDays: row["duration_days"],
    joined: Boolean(enrollment),
    progress: enrollment?.["progress"] ?? 0,
    completed: enrollment?.["completed"] ?? false,
    startedAt: enrollment?.["started_at"] ?? null,
  };
}

function categorize(input: string): ActivityCategory {
  const text = input.toLowerCase();
  if (/\b(car|drive|driving|commut|travel|bus|train|metro|bike|bicycle|flight|plane|college|walk)\b/.test(text)) {
    return "Transportation";
  }
  if (/\b(light|electricity|energy|fan|ac|air condition|heater|appliance|power)\b/.test(text)) {
    return "Energy";
  }
  if (/\b(water|tap|shower|bath|leak|laundry|washing)\b/.test(text)) {
    return "Water";
  }
  if (/\b(food|meat|vegetarian|vegan|meal|restaurant|grocery|leftover|produce)\b/.test(text)) {
    return "Food";
  }
  if (/\b(shop|shopping|buy|purchase|bottle|bag|clothes|clothing|packaging)\b/.test(text)) {
    return "Shopping";
  }
  if (/\b(plastic|recycl|trash|waste|compost|disposable|single.use)\b/.test(text)) {
    return "Waste";
  }
  if (/\b(habit|routine|garden|plant|clean|home)\b/.test(text)) {
    return "Lifestyle";
  }
  return "Other";
}

function inferChoice(input: string, category: ActivityCategory): string {
  const text = input.toLowerCase();
  const choices: Record<ActivityCategory, Array<[RegExp, string]>> = {
    Transportation: [
      [/\b(car|drive|driving)\b/, "Car"],
      [/\b(bus)\b/, "Bus"],
      [/\b(train|metro|subway)\b/, "Train or metro"],
      [/\b(plane|flight|flying)\b/, "Air travel"],
      [/\b(motorcycle|scooter)\b/, "Motorized two-wheeler"],
      [/\b(bike|bicycle|cycling)\b/, "Bicycle"],
    ],
    Energy: [
      [/\b(ac|air condition|cooling)\b/, "Air conditioning"],
      [/\b(heater|heating)\b/, "Heating"],
      [/\b(light|lamp)\b/, "Electric lighting"],
      [/\b(fan)\b/, "Electric fan"],
    ],
    Water: [
      [/\b(shower|bath)\b/, "Showering or bathing"],
      [/\b(tap|faucet|brush)\b/, "Running tap water"],
      [/\b(laundry|washing)\b/, "Laundry"],
    ],
    Food: [
      [/\b(meat|beef|lamb|chicken)\b/, "Meal with meat"],
      [/\b(restaurant|takeaway|delivery)\b/, "Restaurant or takeaway"],
      [/\b(leftover|food waste)\b/, "Food that may go uneaten"],
    ],
    Shopping: [
      [/\b(bottle)\b/, "Single-use or purchased bottles"],
      [/\b(bag)\b/, "Shopping bags"],
      [/\b(clothes|clothing|fashion)\b/, "Clothing purchase"],
    ],
    Waste: [
      [/\b(plastic|disposable|single.use)\b/, "Single-use plastic"],
      [/\b(trash|waste|recycl)\b/, "Household waste"],
      [/\b(compost)\b/, "Food scraps"],
    ],
    Lifestyle: [],
    Other: [],
  };

  for (const [pattern, choice] of choices[category]) {
    if (pattern.test(text)) return choice;
  }
  return "Current everyday choice";
}

function inferFrequency(input: string): string {
  const text = input.toLowerCase();
  if (/\b(daily|every day|each day|everyday)\b/.test(text)) return "Daily";
  if (/\b(weekly|every week|each week)\b/.test(text)) return "Weekly";
  if (/\b(monthly|every month|each month)\b/.test(text)) return "Monthly";
  if (/\b(occasionally|sometimes|once in a while)\b/.test(text)) return "Occasionally";
  if (/\b(usually|often|regularly)\b/.test(text)) return "Often";
  return "Not specified";
}

function inferImpact(input: string, category: ActivityCategory): "Low" | "Medium" | "High" {
  const text = input.toLowerCase();
  const frequent = /\b(daily|every day|each day|everyday|usually|often|regularly)\b/.test(text);
  const highImpactChoice =
    /\b(flight|plane|beef|lamb|ac|air condition|long shower)\b/.test(text);
  const meaningfulImpactChoice =
    /\b(car|drive|driving|flight|plane|beef|lamb|ac|air condition|long shower)\b/.test(text);
  if (frequent && highImpactChoice) return "High";
  if (meaningfulImpactChoice || frequent || category !== "Other") return "Medium";
  return "Low";
}

function recommendationDrafts(category: ActivityCategory): RecommendationDraft[] {
  const options: Record<ActivityCategory, RecommendationDraft[]> = {
    Transportation: [
      {
        title: "Cycling",
        description: "For a short, suitable trip, consider cycling when the route and conditions feel safe.",
        difficulty: "Easy",
        points: 20,
        estimatedImpact: "A lower-impact option than travelling alone by car.",
      },
      {
        title: "Public transport",
        description: "Try a bus, train, or metro for a route where service is convenient.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Can reduce the need for individual car trips.",
      },
      {
        title: "Carpooling",
        description: "Share the ride with someone going a similar way.",
        difficulty: "Moderate",
        points: 15,
        estimatedImpact: "Fewer separate vehicles for the same journey.",
      },
    ],
    Energy: [
      {
        title: "Switch off unused lights",
        description: "Turn lights off when leaving a room and use daylight when practical.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Helps avoid electricity use when lighting is not needed.",
      },
      {
        title: "Adjust cooling thoughtfully",
        description: "Use a comfortable setting and switch cooling off when the room is empty.",
        difficulty: "Easy",
        points: 20,
        estimatedImpact: "May reduce avoidable energy use.",
      },
      {
        title: "Choose efficient appliances",
        description: "When replacing an appliance, compare its energy-efficiency label.",
        difficulty: "Moderate",
        points: 25,
        estimatedImpact: "Efficient appliances can use less energy for similar tasks.",
      },
    ],
    Water: [
      {
        title: "Shorten your shower",
        description: "Try trimming a minute from your usual shower when it is comfortable to do so.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Can reduce the time water is running.",
      },
      {
        title: "Turn off the tap",
        description: "Close the tap while brushing your teeth or lathering your hands.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Avoids running water when it is not needed.",
      },
      {
        title: "Check for leaks",
        description: "Look for dripping taps and report or fix leaks where you can.",
        difficulty: "Moderate",
        points: 20,
        estimatedImpact: "Stops water from being lost between uses.",
      },
    ],
    Food: [
      {
        title: "Try a plant-forward meal",
        description: "Swap one meal for a satisfying plant-based option you already enjoy.",
        difficulty: "Easy",
        points: 20,
        estimatedImpact: "A practical way to explore lower-impact meal choices.",
      },
      {
        title: "Plan portions and leftovers",
        description: "Plan portions ahead and store leftovers so they are easy to use.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Can help prevent edible food from going uneaten.",
      },
      {
        title: "Choose seasonal produce",
        description: "When available and affordable, add locally grown seasonal produce.",
        difficulty: "Moderate",
        points: 15,
        estimatedImpact: "Supports seasonal choices when practical for your area.",
      },
    ],
    Shopping: [
      {
        title: "Bring a reusable bag",
        description: "Keep a reusable bag near your keys or in your everyday carry.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Helps avoid taking a new bag for each shopping trip.",
      },
      {
        title: "Carry a refillable bottle",
        description: "Bring a bottle you can refill where safe drinking water is available.",
        difficulty: "Easy",
        points: 20,
        estimatedImpact: "Can reduce reliance on single-use drink bottles.",
      },
      {
        title: "Choose durable items",
        description: "Before replacing something, consider whether a durable or repairable option fits.",
        difficulty: "Moderate",
        points: 25,
        estimatedImpact: "Longer-lasting purchases can reduce replacement frequency.",
      },
    ],
    Waste: [
      {
        title: "Reuse before replacing",
        description: "Use a sturdy container or item again when it is clean and safe to do so.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Keeps usable items in service for longer.",
      },
      {
        title: "Sort recyclable materials",
        description: "Check your local recycling guidance and separate accepted materials.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Helps materials follow your area's recycling process.",
      },
      {
        title: "Avoid single-use items",
        description: "For a repeat purchase, try a reusable alternative if it suits the situation.",
        difficulty: "Moderate",
        points: 20,
        estimatedImpact: "Can reduce disposable items in your routine.",
      },
    ],
    Lifestyle: [
      {
        title: "Make a small repeatable swap",
        description: "Pick one simple change you can repeat comfortably this week.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Small consistent habits are easier to maintain.",
      },
      {
        title: "Repair or reuse",
        description: "Before replacing an item, check whether it can be repaired, borrowed, or reused.",
        difficulty: "Moderate",
        points: 20,
        estimatedImpact: "Can extend the useful life of everyday items.",
      },
      {
        title: "Share what works",
        description: "Share one practical sustainable tip with someone in your household.",
        difficulty: "Easy",
        points: 10,
        estimatedImpact: "Makes helpful habits easier to repeat together.",
      },
    ],
    Other: [
      {
        title: "Notice one easy alternative",
        description: "Choose one small part of this routine that you could change without adding stress.",
        difficulty: "Easy",
        points: 10,
        estimatedImpact: "A practical first step that fits your own routine.",
      },
      {
        title: "Reuse what you already have",
        description: "Consider whether an item you already own can meet this need.",
        difficulty: "Easy",
        points: 15,
        estimatedImpact: "Can avoid an unnecessary new purchase.",
      },
      {
        title: "Make the change repeatable",
        description: "Set up a small reminder or cue that makes the greener choice easier next time.",
        difficulty: "Moderate",
        points: 15,
        estimatedImpact: "Helps turn an intention into a repeatable routine.",
      },
    ],
  };
  return options[category];
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function lastSevenDays() {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() - (6 - index));
    return toDateOnly(day);
  });
}

async function loadChallengeProgress(
  client: AuthenticatedSupabase["client"],
  userId: string,
) {
  const [challengesResult, userChallengesResult] = await Promise.all([
    client.from("challenges").select("*").eq("active", true).order("target_count"),
    client.from("user_challenges").select("*").eq("user_id", userId),
  ]);
  assertNoError(challengesResult.data, challengesResult.error);
  assertNoError(userChallengesResult.data, userChallengesResult.error);
  const enrollments = new Map(
    ((userChallengesResult.data ?? []) as Row[]).map((item) => [
      item["challenge_id"],
      item,
    ]),
  );
  return ((challengesResult.data ?? []) as Row[]).map((challenge) =>
    mapChallenge(challenge, enrollments.get(challenge["id"])),
  );
}

async function loadBadgeProgress(
  client: AuthenticatedSupabase["client"],
  userId: string,
) {
  const [badgesResult, earnedResult, profile] = await Promise.all([
    client.from("badges").select("*").order("requirement_value"),
    client.from("user_badges").select("badge_id, earned_at").eq("user_id", userId),
    client.from("profiles").select("*").eq("id", userId).single(),
  ]);
  assertNoError(badgesResult.data, badgesResult.error);
  assertNoError(earnedResult.data, earnedResult.error);
  assertNoError(profile.data, profile.error);

  const completedResult = await client
    .from("recommendations")
    .select("category")
    .eq("user_id", userId)
    .eq("is_completed", true);
  assertNoError(completedResult.data, completedResult.error);

  const categoryCounts = new Map<string, number>();
  for (const item of (completedResult.data ?? []) as Row[]) {
    const category = String(item["category"]);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const earned = new Map(
    ((earnedResult.data ?? []) as Row[]).map((item) => [
      item["badge_id"],
      item["earned_at"],
    ]),
  );
  const profileRow = profile.data as Row;

  return ((badgesResult.data ?? []) as Row[]).map((badge) => {
    const requirementType = String(badge["requirement_type"]);
    const progress =
      requirementType === "activity_count"
        ? Number(profileRow["total_activities"] ?? 0)
        : requirementType === "total_points"
          ? Number(profileRow["total_points"] ?? 0)
          : requirementType === "streak_days"
            ? Number(profileRow["current_streak"] ?? 0)
            : requirementType.startsWith("category:")
              ? (categoryCounts.get(requirementType.slice("category:".length)) ?? 0)
              : 0;
    return {
      ...mapBadge(badge),
      requirementType,
      requirementValue: badge["requirement_value"],
      earnedAt: earned.get(badge["id"]) ?? null,
      progress,
    };
  });
}

router.post("/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please describe an activity in at least 8 characters." });
    return;
  }

  const { client, user } = context(res);
  const inputText = parsed.data.inputText.trim();
  if (inputText.length < 8) {
    res.status(400).json({ error: "Please add a little more detail about your activity." });
    return;
  }

  const category = categorize(inputText);
  const frequency = inferFrequency(inputText);
  const currentChoice = inferChoice(inputText, category);
  const impactLevel = inferImpact(inputText, category);
  const activityName =
    inputText.split(/[.!?]/)[0]?.trim().slice(0, 100) || "Everyday activity";
  const analysis =
    `This ${frequency.toLowerCase()} ${category.toLowerCase()} routine currently involves ${currentChoice.toLowerCase()}. ` +
    "The suggestions below focus on practical alternatives you can adapt to your needs, route, and local options.";

  const activityResult = await client
    .from("activities")
    .insert({
      user_id: user.id,
      input_text: inputText,
      category,
      activity_name: activityName,
      current_choice: currentChoice,
      frequency,
      impact_level: impactLevel,
      analysis,
    })
    .select("*")
    .single();
  assertNoError(activityResult.data, activityResult.error);
  const activity = activityResult.data as Row;
  const drafts = recommendationDrafts(category);
  const recommendationsResult = await client
    .from("recommendations")
    .insert(
      drafts.map((recommendation) => ({
        activity_id: activity["id"],
        user_id: user.id,
        title: recommendation.title,
        description: recommendation.description,
        category,
        difficulty: recommendation.difficulty,
        points: recommendation.points,
        estimated_impact: recommendation.estimatedImpact,
      })),
    )
    .select("*");
  assertNoError(recommendationsResult.data, recommendationsResult.error);

  const response = AnalyzeActivityResponse.parse({
    activity: {
      id: activity["id"],
      inputText: activity["input_text"],
      category: activity["category"],
      activityName: activity["activity_name"],
      currentChoice: activity["current_choice"],
      frequency: activity["frequency"],
      impactLevel: activity["impact_level"],
      analysis: activity["analysis"],
      createdAt: activity["created_at"],
      pointsEarned: 0,
      recommendations: ((recommendationsResult.data ?? []) as Row[]).map(
        mapRecommendation,
      ),
    },
  });
  res.status(201).json(response);
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const { client, user } = context(res);
  const profileRow = await loadProfile(client, user);
  const dates = lastSevenDays();
  const [activitiesResult, dailyResult, earnedResult, challengeProgress] =
    await Promise.all([
      client
        .from("activities")
        .select("*, recommendations(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("daily_activity")
        .select("activity_date, activity_count, points")
        .eq("user_id", user.id)
        .gte("activity_date", dates[0])
        .lte("activity_date", dates[6]),
      client
        .from("user_badges")
        .select("badges(*)")
        .eq("user_id", user.id),
      loadChallengeProgress(client, user.id),
    ]);
  assertNoError(activitiesResult.data, activitiesResult.error);
  assertNoError(dailyResult.data, dailyResult.error);
  assertNoError(earnedResult.data, earnedResult.error);

  const activities = ((activitiesResult.data ?? []) as Row[]).map(mapActivity);
  const categoryCounts = new Map<ActivityCategory, number>();
  for (const activity of activities) {
    const category = activity["category"] as ActivityCategory;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const dailyByDate = new Map(
    ((dailyResult.data ?? []) as Row[]).map((day) => [
      String(day["activity_date"]).slice(0, 10),
      day,
    ]),
  );
  const weeklyActivity = dates.map((date) => {
    const item = dailyByDate.get(date);
    return {
      date,
      activityCount: Number(item?.["activity_count"] ?? 0),
      points: Number(item?.["points"] ?? 0),
    };
  });
  const earnedBadges = ((earnedResult.data ?? []) as Row[])
    .map((item) => item["badges"])
    .filter((badge): badge is Row => Boolean(badge))
    .map(mapBadge);
  const response = GetDashboardResponse.parse({
    profile: mapProfile(profileRow),
    weeklyActivity,
    categoryBreakdown: Array.from(categoryCounts, ([category, count]) => ({
      category,
      count,
    })),
    recentActivities: activities.slice(0, 5),
    earnedBadges,
    activeChallenges: challengeProgress.filter(
      (challenge) => challenge["joined"] && !challenge["completed"],
    ),
    pointsHistory: weeklyActivity.map(({ date, points }) => ({ date, points })),
  });
  res.json(response);
});

router.get("/activities", async (req, res): Promise<void> => {
  const parsed = GetActivitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid activity filter." });
    return;
  }

  const { client, user } = context(res);
  let query = client
    .from("activities")
    .select("*, recommendations(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(250);
  if (parsed.data.category) query = query.eq("category", parsed.data.category);

  const result = await query;
  assertNoError(result.data, result.error);
  let activities = ((result.data ?? []) as Row[]).map(mapActivity);
  if (parsed.data.search) {
    const search = parsed.data.search.toLocaleLowerCase();
    activities = activities.filter((activity) =>
      [
        activity["inputText"],
        activity["activityName"],
        activity["currentChoice"],
        activity["category"],
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search),
    );
  }
  res.json(GetActivitiesResponse.parse(activities));
});

router.get("/activities/:activityId", async (req, res): Promise<void> => {
  const parsed = GetActivityParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid activity." });
    return;
  }
  const { client, user } = context(res);
  const result = await client
    .from("activities")
    .select("*, recommendations(*)")
    .eq("user_id", user.id)
    .eq("id", parsed.data.activityId)
    .maybeSingle();
  assertNoError(result.data, result.error);
  if (!result.data) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  res.json(GetActivityResponse.parse(mapActivity(result.data as Row)));
});

router.post(
  "/recommendations/:recommendationId/complete",
  async (req, res): Promise<void> => {
    const parsed = CompleteRecommendationParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid recommendation." });
      return;
    }
    const { client, user } = context(res);
    const completion = await client.rpc("complete_recommendation", {
      p_recommendation_id: parsed.data.recommendationId,
    });
    if (completion.error) {
      if (completion.error.code === "P0002") {
        res.status(404).json({
          error: "This recommendation was already completed or is unavailable.",
        });
        return;
      }
      throw new Error(completion.error.message);
    }

    const rpcData = completion.data as {
      recommendation_id?: string;
      new_badge_ids?: string[];
    } | null;
    const [profileRow, recommendationResult, challengeProgress] =
      await Promise.all([
        loadProfile(client, user),
        client
          .from("recommendations")
          .select("*")
          .eq("user_id", user.id)
          .eq("id", parsed.data.recommendationId)
          .single(),
        loadChallengeProgress(client, user.id),
      ]);
    assertNoError(recommendationResult.data, recommendationResult.error);

    const newBadgeIds = rpcData?.new_badge_ids ?? [];
    let newBadges: ReturnType<typeof mapBadge>[] = [];
    if (newBadgeIds.length > 0) {
      const newBadgeResult = await client
        .from("badges")
        .select("*")
        .in("id", newBadgeIds);
      assertNoError(newBadgeResult.data, newBadgeResult.error);
      newBadges = ((newBadgeResult.data ?? []) as Row[]).map(mapBadge);
    }

    const response = CompleteRecommendationResponse.parse({
      recommendation: mapRecommendation(recommendationResult.data as Row),
      profile: mapProfile(profileRow),
      newBadges,
      updatedChallenges: challengeProgress,
    });
    res.json(response);
  },
);

router.get("/badges", async (_req, res): Promise<void> => {
  const { client, user } = context(res);
  const badges = await loadBadgeProgress(client, user.id);
  res.json(GetBadgesResponse.parse(badges));
});

router.get("/challenges", async (_req, res): Promise<void> => {
  const { client, user } = context(res);
  const challenges = await loadChallengeProgress(client, user.id);
  res.json(GetChallengesResponse.parse(challenges));
});

router.post("/challenges/:challengeId/join", async (req, res): Promise<void> => {
  const parsed = JoinChallengeParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid challenge." });
    return;
  }
  const { client, user } = context(res);
  const challenge = await client
    .from("challenges")
    .select("*")
    .eq("id", parsed.data.challengeId)
    .eq("active", true)
    .maybeSingle();
  assertNoError(challenge.data, challenge.error);
  if (!challenge.data) {
    res.status(404).json({ error: "This challenge is not available." });
    return;
  }

  const enrollment = await client
    .from("user_challenges")
    .upsert(
      { user_id: user.id, challenge_id: parsed.data.challengeId },
      { onConflict: "user_id,challenge_id", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();
  assertNoError(enrollment.data, enrollment.error);

  const existing =
    enrollment.data ??
    (
      await client
        .from("user_challenges")
        .select("*")
        .eq("user_id", user.id)
        .eq("challenge_id", parsed.data.challengeId)
        .single()
    ).data;
  if (!existing) throw new Error("Challenge enrollment was not saved");

  res.json(
    JoinChallengeResponse.parse(
      mapChallenge(challenge.data as Row, existing as Row),
    ),
  );
});

router.patch("/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check your profile details and try again." });
    return;
  }
  const { client, user } = context(res);
  const update: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) {
    update["full_name"] = parsed.data.fullName.trim();
  }
  if (parsed.data.avatarUrl !== undefined) {
    update["avatar_url"] = parsed.data.avatarUrl;
  }
  if (parsed.data.preferredCategory !== undefined) {
    update["preferred_category"] = parsed.data.preferredCategory;
  }
  const result = await client
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("*")
    .single();
  assertNoError(result.data, result.error);
  res.json(UpdateProfileResponse.parse(mapProfile(result.data as Row)));
});

export default router;
