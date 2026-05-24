<script lang="ts">
	import { buildTopicTree, quotes, authors } from '$lib/data';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	const tree = buildTopicTree();
	const totalTopics = tree.reduce((n, s) => n + s.topics.length, 0);
	const totalQuotes = quotes.length;
	const totalAuthors = authors.length;
</script>

<MetaTags
	title="Accueil"
	fullTitle="Tradition Apostolique · le témoignage des Pères de l'Église, sujet par sujet"
	description="Anthologie française du témoignage des Pères de l'Église, organisée thème par thème : baptême, eucharistie, Tradition, succession apostolique, sacrifice de la messe, Marie, et plus. Traductions directes du grec, du latin et du syriaque."
/>

<article>
	<h1
		class="font-heading font-bold text-accent leading-[1.05]"
		style="font-size: clamp(2.5rem, 5vw, 4rem);"
	>
		Tradition Apostolique
	</h1>

	<p class="mt-4 max-w-prose font-body text-lg leading-[1.6] text-foreground">
		Ce site rassemble, thème par thème, le témoignage des Pères de l’Église sur
		les principaux articles de la foi chrétienne.
	</p>

	<section class="mt-16">
		<h2
			class="font-heading italic text-accent leading-[1.15]"
			style="font-size: 1.75rem;"
		>
			Aux sources de la foi
		</h2>
		<div class="mt-4 space-y-4 max-w-prose font-body text-base leading-[1.75]">
			<p>
				Durant le premier millénaire chrétien, malgré certaines divergences
				secondaires et quelques voix dissidentes, les Pères de l’Église ont
				manifesté un remarquable consensus doctrinal sur l’essentiel du dépôt
				de la foi : le baptême, l’eucharistie, la succession apostolique,
				l’autorité de la Tradition, le sacrifice de la messe, la régénération
				baptismale, l’intercession des saints, ou encore la pleine divinité du
				Christ.
			</p>
			<p>
				Évêques, martyrs, docteurs, théologiens et témoins privilégiés de la
				Tradition apostolique, ils ont transmis, défendu et explicité la foi
				reçue des apôtres face aux hérésies de leur temps. Leur enseignement
				constitue le témoignage historique le plus ancien et le plus universel
				de ce que l’Église primitive croyait, enseignait et pratiquait.
			</p>
			<p>
				Chaque citation présentée sur ce site a été traduite directement du
				grec, du latin ou du syriaque, souvent pour la première fois en
				français.
			</p>
		</div>
	</section>

	<section class="mt-12">
		<h2
			class="font-heading italic text-accent leading-[1.15]"
			style="font-size: 1.75rem;"
		>
			Pourquoi les Pères&nbsp;?
		</h2>
		<div class="mt-4 space-y-4 max-w-prose font-body text-base leading-[1.75]">
			<p>
				Une grande partie des débats théologiques contemporains se déroule
				aujourd’hui sans référence sérieuse au témoignage des premiers
				siècles chrétiens. Pourtant, toute prétention à représenter le
				Christianisme Apostolique doit nécessairement être confrontée à la
				réalité historique de la foi de l’Église ancienne.
			</p>
			<p>
				Les Pères n’étaient pas individuellement infaillibles. Cependant,
				lorsque leurs témoignages convergent de manière large, constante et
				universelle, ce que la théologie catholique appelle le
				<em class="italic">consensus patrum</em>, leur accord possède une
				autorité doctrinale singulière. Il constitue un témoin privilégié de
				la Sainte Tradition et de l’intelligence historique de la foi
				Catholique.
			</p>
			<p>
				Leurs écrits sont aujourd’hui accessibles en ligne, mais rarement
				organisés par thème, et plus rarement encore traduits en français à
				partir des langues originales. Ce site a pour objectif de rendre ce
				patrimoine plus accessible, afin de montrer ce que l’Église a cru
				<em class="italic">toujours, partout et par tous</em>
				(<em class="italic">semper, ubique et ab omnibus</em>), selon la
				formule classique de
				<a
					href="/peres/vincent-de-lerins"
					class="border-b border-foreground/20 hover:border-active hover:text-active"
					>saint Vincent de Lérins</a
				>.
			</p>
		</div>
	</section>

	<section class="mt-12">
		<h2
			class="font-heading italic text-accent leading-[1.15]"
			style="font-size: 1.75rem;"
		>
			Les trois âges patristiques
		</h2>
		<div class="mt-4 space-y-4 max-w-prose font-body text-base leading-[1.75]">
			<p>
				On distingue traditionnellement trois grandes périodes dans l’ère
				patristique.
			</p>
			<p>
				Les Pères apostoliques, contemporains des apôtres ou de leurs
				disciples immédiats, représentent le lien le plus direct avec
				l’Église du Nouveau Testament. Ils ont reçu et transmis
				l’enseignement de la première génération chrétienne. C’est l’époque
				de
				<a href="/peres/clement-de-rome" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Clément de Rome</a>,
				de
				<a href="/peres/ignace-d-antioche" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Ignace d’Antioche</a>
				et de
				<a href="/peres/polycarpe-de-smyrne" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Polycarpe de Smyrne</a>.
			</p>
			<p>
				Les Pères pré-nicéens ont écrit entre la période apostolique et le
				premier concile œcuménique de Nicée, en 325. Face aux hérésies
				naissantes, ils ont défendu la règle de foi
				(<em class="italic">regula fidei</em>) transmise par l’Église. Parmi
				eux figurent
				<a href="/peres/irenee-de-lyon" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Irénée de Lyon</a>,
				<a href="/peres/justin-martyr" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Justin Martyr</a>,
				<a href="/peres/tertullien" class="border-b border-foreground/20 hover:border-active hover:text-active">Tertullien</a>,
				<a href="/peres/origene" class="border-b border-foreground/20 hover:border-active hover:text-active">Origène</a>
				et
				<a href="/peres/cyprien-de-carthage" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Cyprien de Carthage</a>.
			</p>
			<p>
				Les Pères nicéens et post-nicéens, enfin, ont contribué à la
				formulation dogmatique de la foi chrétienne lors des grands conciles
				de l’Antiquité. Leurs écrits ont profondément façonné la théologie
				Catholique et la doctrine trinitaire. On y trouve
				<a href="/peres/augustin-d-hippone" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Augustin d’Hippone</a>,
				<a href="/peres/jean-chrysostome" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Jean Chrysostome</a>,
				<a href="/peres/jerome-de-stridon" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Jérôme</a>,
				<a href="/peres/basile-de-cesaree" class="border-b border-foreground/20 hover:border-active hover:text-active">saint Basile de Césarée</a>,
				ainsi que les deux Grégoires,
				<a href="/peres/gregoire-de-nazianze" class="border-b border-foreground/20 hover:border-active hover:text-active">de Nazianze</a>
				et
				<a href="/peres/gregoire-de-nysse" class="border-b border-foreground/20 hover:border-active hover:text-active">de Nysse</a>.
			</p>
		</div>
	</section>

	<section class="mt-12">
		<h2
			class="font-heading italic text-accent leading-[1.15]"
			style="font-size: 1.75rem;"
		>
			La voix de l’Église
		</h2>
		<div class="mt-6 space-y-8 max-w-prose font-body text-base leading-[1.75]">
			<div>
				<blockquote class="italic">
					« Cette transmission vivante, accomplie dans l’Esprit Saint, est
					appelée la Tradition en tant que distincte de la Sainte Écriture,
					quoique étroitement liée à elle. Par elle, « l’Église perpétue dans
					sa doctrine, sa vie et son culte et elle transmet à chaque
					génération tout ce qu’elle est elle-même, tout ce qu’elle croit. »
					« L’enseignement des saints Pères atteste la présence vivifiante de
					cette Tradition, dont les richesses passent dans la pratique et la
					vie de l’Église qui croit et qui prie. »
				</blockquote>
				<p class="mt-2 font-body text-sm italic text-muted">
					<a
						href="https://catechismecatholique.fr/cec/78"
						target="_blank"
						rel="noopener"
						class="hover:text-active"
					>
						Catéchisme de l’Église catholique, § 78
						<span class="not-italic" aria-hidden="true">↗</span>
					</a>
				</p>
			</div>
			<div>
				<blockquote class="italic">
					« Au cours des premiers siècles, l’Église a cherché de formuler plus
					explicitement sa foi trinitaire tant pour approfondir sa propre
					intelligence de la foi que pour la défendre contre des erreurs qui
					la déformaient. Ce fut l’œuvre des Conciles anciens, aidés par le
					travail théologique des Pères de l’Église et soutenus par le sens
					de la foi du peuple chrétien. »
				</blockquote>
				<p class="mt-2 font-body text-sm italic text-muted">
					<a
						href="https://catechismecatholique.fr/cec/250"
						target="_blank"
						rel="noopener"
						class="hover:text-active"
					>
						Catéchisme de l’Église catholique, § 250
						<span class="not-italic" aria-hidden="true">↗</span>
					</a>
				</p>
			</div>
		</div>
	</section>

	<p class="mt-16 font-ui text-[11px] font-light uppercase tracking-[0.22em] text-muted">
		{totalQuotes.toLocaleString('fr-FR')} citations &middot; {totalAuthors} Pères &middot;
		{totalTopics} sujets
	</p>
	<p class="mt-2 font-ui text-[11px] font-light uppercase tracking-[0.22em] text-muted">
		Choisissez un sujet dans le sommaire à gauche.
	</p>
</article>
